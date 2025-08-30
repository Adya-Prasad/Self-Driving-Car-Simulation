class Car {
  constructor(x, y, width, height, controlType, maxspeed = 3.9) { // Reduced by 0.1 for slower speeds
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.speed = 0;
    this.acceleration = 0.19; // Reduced by 0.01 for slower acceleration
    this.maxspeed = maxspeed;
    this.friction = 0.05;
    this.angle = 0;
    this.damaged = false;
    this.controlType = controlType; // Store control type

    // Add fitness tracking for curved tracks
    this.fitness = 0;
    this.distanceTraveled = 0;
    this.timeAlive = 0;

    this.useAiBrain = controlType == "AI";

    if (controlType === "DUMMY") {
      this.t = 0; // track parameter (0 to 2PI) - will be set properly in main.js
      this.trackspeed = 0.01;
      this.invincible = true; // prevent damage
      this.laneIndex = 1; // default to middle lane, will be set in main.js
    }

    if (controlType != "DUMMY") {
      this.sensor = new Sensor(this);
      // Enhanced 4-layer neural network for better decision making
      // input layer: 7 sensors + 2 speed/angle inputs = 9 total inputs
      // hidden layers: 12 and 8 neurons for complex pattern recognition
      // output layer: 4 neurons (forward, left, right, reverse)
      this.brain = new NeuralNetwork([this.sensor.rayCount + 2, 12, 8, 4]);
    }
    this.controls = new Controls(controlType);
  }

  update(roadBorders, traffic, road) {
    if (this.controlType === "DUMMY") {
      this.#moveDummyOnTrack(road);
      this.polygon = this.#createPolygon();
    } else {
      if (!this.damaged) {
        const prevX = this.x;
        const prevY = this.y;

        this.#move();
        this.polygon = this.#createPolygon();
        this.damaged = this.#assessDamage(roadBorders, traffic);

        // Update fitness tracking
        if (!this.damaged) {
          this.timeAlive++;
          const distMoved = Math.hypot(this.x - prevX, this.y - prevY);
          this.distanceTraveled += distMoved;

          // For curved tracks, also track progress around the track
          if (road && road.trackType === "curved") {
            // Update track parameter based on movement
            const prevT = this.t || 0;
            this.updateTrackParameter(road);

            // Calculate forward progress (reward) vs backward movement (penalty)
            let progressDelta = this.t - prevT;

            // Handle wraparound (completing a lap)
            if (progressDelta < -Math.PI) progressDelta += 2 * Math.PI;
            if (progressDelta > Math.PI) progressDelta -= 2 * Math.PI;

            // Reward forward progress, penalize backward movement
            const progressReward =
              progressDelta > 0 ? progressDelta * 500 : progressDelta * 1000;

            // Enhanced fitness calculation for better learning
            const speedBonus = this.speed > 0 ? this.speed * 10 : this.speed * 50; // Strong penalty for reverse
            
            // Reward smooth driving (penalize excessive turning)
            const turnPenalty = Math.abs(this.controls.left - this.controls.right) > 0.8 ? -5 : 0;

            // Strong bonus for maintaining optimal speed (1.4-2.4) - reduced by 0.1
            const optimalSpeedBonus = (this.speed > 1.4 && this.speed < 2.4) ? 20 : 0;
            
            // Bonus for continuous movement (penalize stopping)
            const movementBonus = this.speed > 0.4 ? 15 : -10; // Reduced threshold by 0.1
            
            // Bonus for staying alive longer
            const survivalBonus = this.timeAlive * 2;
            
            // Track progress is most important
            const trackProgressBonus = progressReward * 2;

            this.fitness = survivalBonus + 
                          this.distanceTraveled * 15 + 
                          trackProgressBonus + 
                          speedBonus + 
                          turnPenalty + 
                          optimalSpeedBonus + 
                          movementBonus;
          } else {
            this.fitness = this.timeAlive + this.distanceTraveled * 10; // Original fitness
          }
        }
      }
    }
    if (this.sensor) {
      this.sensor.update(roadBorders, traffic);
      const offsets = this.sensor.readings.map((s) =>
        s == null ? 0 : 1 - s.offset
      );
      
      // Enhanced inputs: sensor data + speed + angular velocity
      const normalizedSpeed = this.speed / this.maxspeed; // Normalize speed to 0-1
      const normalizedAngle = (this.angle % (2 * Math.PI)) / (2 * Math.PI); // Normalize angle to 0-1
      
      const enhancedInputs = [...offsets, normalizedSpeed, normalizedAngle];
      const outputs = NeuralNetwork.feedforward(enhancedInputs, this.brain);
      // console.log("Enhanced Inputs:", enhancedInputs);
      // console.log("Network Outputs:", outputs);

      if (this.useAiBrain) {
        // Process tanh outputs (-1 to 1) into control signals (0 to 1)
        // Convert tanh outputs to positive values and add forward bias
        this.controls.forward = Math.max(0.3, (outputs[0] + 1) / 2); // Always some forward bias (reduced by 0.1)
        this.controls.left = Math.max(0, outputs[1]); // Only positive values for left
        this.controls.right = Math.max(0, outputs[2]); // Only positive values for right
        this.controls.reverse = Math.max(0, (outputs[3] + 1) / 2 - 0.7); // Strongly discourage reverse

        // Smooth out conflicting controls to reduce shaking
        if (this.controls.left > 0.3 && this.controls.right > 0.3) {
          // If both left and right are strong, reduce both
          const diff = this.controls.left - this.controls.right;
          if (Math.abs(diff) < 0.2) {
            this.controls.left = 0;
            this.controls.right = 0;
          } else {
            // Keep the stronger direction, reduce the weaker
            if (this.controls.left > this.controls.right) {
              this.controls.right = 0;
              this.controls.left = Math.min(this.controls.left, 0.8);
            } else {
              this.controls.left = 0;
              this.controls.right = Math.min(this.controls.right, 0.8);
            }
          }
        }

        // Prevent reverse when moving forward well
        if (this.controls.forward > 0.5 && this.speed > 1) {
          this.controls.reverse = 0;
        }
        
        // Emergency forward boost if car is too slow or stopped
        if (this.speed < 0.4) { // Reduced threshold by 0.1
          this.controls.forward = Math.max(this.controls.forward, 0.7); // Reduced boost by 0.1
          this.controls.reverse = 0;
        }
      }
    }
  }
  #assessDamage(roadBorders, traffic) {
    // DUMMY cars are invincible
    if (this.controlType === "DUMMY") {
      return false;
    }

    for (let i = 0; i < roadBorders.length; i++) {
      if (polysIntersect(this.polygon, roadBorders[i])) {
        return true;
      }
    }

    for (let i = 0; i < traffic.length; i++) {
      if (polysIntersect(this.polygon, traffic[i].polygon)) {
        return true;
      }
    }
    return false;
  }

  #createPolygon() {
    const points = [];
    const rad = Math.hypot(this.width, this.height) / 1.5;
    const alpha = Math.atan2(this.width, this.height); // angle
    points.push({
      x: this.x - Math.sin(this.angle - alpha) * rad,
      y: this.y - Math.cos(this.angle - alpha) * rad,
    });
    points.push({
      x: this.x - Math.sin(this.angle + alpha) * rad,
      y: this.y - Math.cos(this.angle + alpha) * rad,
    });
    points.push({
      x: this.x - Math.sin(Math.PI + this.angle - alpha) * rad,
      y: this.y - Math.cos(Math.PI + this.angle - alpha) * rad,
    });
    points.push({
      x: this.x - Math.sin(Math.PI + this.angle + alpha) * rad,
      y: this.y - Math.cos(Math.PI + this.angle + alpha) * rad,
    });
    return points;
  }

  #move() {
    // Smoother acceleration/deceleration
    if (this.controls.forward) {
      this.speed += this.acceleration * this.controls.forward;
    }
    if (this.controls.reverse) {
      this.speed -= this.acceleration * this.controls.reverse;
    }

    // Speed limits
    if (this.speed > this.maxspeed) {
      this.speed = this.maxspeed;
    }
    if (this.speed < -this.maxspeed / 2) {
      this.speed = -this.maxspeed / 2;
    }

    // Smoother friction
    if (this.speed > 0) {
      this.speed -= this.friction;
    }
    if (this.speed < 0) {
      this.speed += this.friction;
    }
    
    // CRITICAL: Prevent cars from stopping completely - maintain minimum forward speed
    if (Math.abs(this.speed) < this.friction) {
      // Instead of stopping, maintain minimum forward momentum
      this.speed = this.useAiBrain ? 0.4 : 0; // AI cars always have minimum speed (reduced by 0.1)
    }
    
    // Additional safety: if AI car speed drops too low, boost it
    if (this.useAiBrain && this.speed < 0.2) {
      this.speed = Math.max(this.speed, 0.2); // Minimum speed for AI cars (reduced by 0.1)
    }

    // Smoother turning with speed-dependent turning rate
    if (this.speed != 0) {
      const flip = this.speed > 0 ? 1 : -1;
      const turnRate =
        0.02 * Math.min(Math.abs(this.speed) / this.maxspeed + 0.3, 1); // Speed-dependent turning

      if (this.controls.left) {
        this.angle += turnRate * flip * this.controls.left;
      }
      if (this.controls.right) {
        this.angle -= turnRate * flip * this.controls.right;
      }
    }

    // Movement with slight smoothing to reduce jitter
    const moveX = -Math.sin(this.angle) * this.speed;
    const moveY = -Math.cos(this.angle) * this.speed;

    this.x += moveX;
    this.y += moveY;
  }

  updateTrackParameter(road) {
    // For AI cars, estimate track parameter based on current position
    // This helps with fitness calculation for curved tracks
    if (!this.t) this.t = 0;

    // Find closest point on track to current car position
    let closestT = this.t;
    let minDistance = Infinity;

    // Check points around current t value with wider search range
    const searchRange = 0.3; // Increased search range
    const searchStep = 0.02; // Finer search step

    for (
      let testT = this.t - searchRange;
      testT <= this.t + searchRange;
      testT += searchStep
    ) {
      const normalizedT =
        ((testT % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

      // Check multiple lanes to find the closest track position
      for (let lane = 0; lane < road.laneCount; lane++) {
        const trackPos = road.getLaneCenter(lane, normalizedT);
        const distance = Math.hypot(this.x - trackPos.x, this.y - trackPos.y);

        if (distance < minDistance) {
          minDistance = distance;
          closestT = normalizedT;
        }
      }
    }

    this.t = closestT;
  }

  #moveDummyOnTrack(road) {
    // update track parameter
    // this.t act as track parameter that represents position on the oval track
    // t = 0 → starting position, t = π → halfway around track, t = 2π → completed one full lap
    this.t += this.trackspeed;
    if (this.t > 2 * Math.PI) {
      this.t -= 2 * Math.PI; // wrap around for continuous laps
    }

    // Get position from road using track parameter and assigned lane
    const position = road.getLaneCenter(this.laneIndex, this.t);

    // Direct positioning to stay exactly on track
    this.x = position.x;
    this.y = position.y;

    // Calculate angle using small forward step (more accurate)
    const deltaT = 0.01;
    const nextT = (this.t + deltaT) % (2 * Math.PI);
    const nextPos = road.getLaneCenter(this.laneIndex, nextT);

    // Calculate direction vector
    const dx = nextPos.x - this.x;
    const dy = nextPos.y - this.y;

    // Set angle to face forward along track (car coordinate system)
    if (Math.hypot(dx, dy) > 0.001) {
      this.angle = Math.atan2(dx, dy); // Car's coordinate system
    }
  }

  draw(ctx, color, drawSensor = false) {
    if (this.damaged) {
      ctx.fillStyle = "#b43b4f0a";
    } else {
      ctx.fillStyle = color;
    }
    ctx.beginPath();
    ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
    for (let i = 1; i < this.polygon.length; i++) {
      ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
    }
    ctx.fill();

    if (this.sensor && drawSensor) {
      this.sensor.draw(ctx);
    }
  }
}
