class Car {
  constructor(x, y, width, height, controlType, maxspeed = 3.1) {
    // Reduced by 0.1 for slower speeds
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.speed = 0;
    this.acceleration = 0.17;
    this.maxspeed = maxspeed;
    this.friction = 0.05;
    this.angle = 0;
    this.damaged = false;
    this.controlType = controlType;

    // Add fitness tracking for curved tracks
    this.fitness = 0;
    this.distanceTraveled = 0;
    this.timeAlive = 0;

    this.useAiBrain = controlType == "AI";

    if (controlType === "DUMMY") {
      this.t = 0;
      this.trackspeed = 0.01;
      this.invincible = true; // prevent damage
      this.laneIndex = 1; // default to middle lane, will be set in main.js
    }

    if (controlType != "DUMMY") {
      this.sensor = new Sensor(this);
      // OPTIMIZED 4-layer neural network for better collision avoidance
      // input layer: 9 sensors + 2 speed/angle inputs = 11 total inputs
      // hidden layers: 16 and 10 neurons for enhanced pattern recognition
      // output layer: 4 neurons (forward, left, right, reverse)
      this.brain = new NeuralNetwork([this.sensor.rayCount + 2, 16, 10, 4]);
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

            // OPTIMIZED fitness calculation for better learning and collision avoidance
            const speedBonus =
              this.speed > 0 ? this.speed * 8 : this.speed * 100; // Stronger reverse penalty

            // Enhanced smooth driving rewards
            const turnPenalty =
              Math.abs(this.controls.left - this.controls.right) > 0.6
                ? -10
                : 0;
            const smoothTurnBonus =
              Math.abs(this.controls.left - this.controls.right) < 0.3 ? 5 : 0;

            // Optimal speed with wider range for better learning
            const optimalSpeedBonus =
              this.speed > 1.2 && this.speed < 2.6 ? 25 : 0;

            // Movement consistency bonus
            const movementBonus = this.speed > 0.5 ? 20 : -15;

            // Collision avoidance bonus - reward cars that stay alive longer
            const survivalBonus = this.timeAlive * 3;

            // Distance from obstacles bonus (encourage safe driving)
            let safetyBonus = 0;
            if (this.sensor && this.sensor.readings) {
              const avgDistance =
                this.sensor.readings
                  .filter((r) => r !== null)
                  .reduce((sum, r) => sum + r.offset, 0) /
                Math.max(
                  1,
                  this.sensor.readings.filter((r) => r !== null).length
                );
              safetyBonus = avgDistance > 0.3 ? 10 : 0; // Reward maintaining distance
            }

            // Track progress is most important - increased weight
            const trackProgressBonus = progressReward * 3;

            this.fitness =
              survivalBonus +
              this.distanceTraveled * 12 +
              trackProgressBonus +
              speedBonus +
              turnPenalty +
              smoothTurnBonus +
              optimalSpeedBonus +
              movementBonus +
              safetyBonus;
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
        // OPTIMIZED: Smoother control processing with temporal smoothing
        const rawForward = Math.max(0.2, (outputs[0] + 1) / 2);
        const rawLeft = Math.max(0, outputs[1]);
        const rawRight = Math.max(0, outputs[2]);
        const rawReverse = Math.max(0, (outputs[3] + 1) / 2 - 0.8);

        // Temporal smoothing to reduce flickering (exponential moving average)
        const smoothingFactor = 0.7;
        this.controls.forward = this.controls.forward
          ? this.controls.forward * smoothingFactor +
            rawForward * (1 - smoothingFactor)
          : rawForward;
        this.controls.left = this.controls.left
          ? this.controls.left * smoothingFactor +
            rawLeft * (1 - smoothingFactor)
          : rawLeft;
        this.controls.right = this.controls.right
          ? this.controls.right * smoothingFactor +
            rawRight * (1 - smoothingFactor)
          : rawRight;
        this.controls.reverse = this.controls.reverse
          ? this.controls.reverse * smoothingFactor +
            rawReverse * (1 - smoothingFactor)
          : rawReverse;

        // Enhanced conflict resolution with gentler transitions
        if (this.controls.left > 0.2 && this.controls.right > 0.2) {
          const diff = this.controls.left - this.controls.right;
          if (Math.abs(diff) < 0.15) {
            // Very close values - reduce both gradually
            this.controls.left *= 0.5;
            this.controls.right *= 0.5;
          } else {
            // Keep stronger direction, gradually reduce weaker
            if (this.controls.left > this.controls.right) {
              this.controls.right *= 0.3;
              this.controls.left = Math.min(this.controls.left, 0.9);
            } else {
              this.controls.left *= 0.3;
              this.controls.right = Math.min(this.controls.right, 0.9);
            }
          }
        }

        // Intelligent speed management
        if (this.controls.forward > 0.6 && this.speed > 1.5) {
          this.controls.reverse = 0;
        }

        // Adaptive forward boost based on sensor readings
        if (this.speed < 0.3) {
          // Check if path ahead is clear before boosting
          const frontClear =
            !this.sensor.readings[Math.floor(this.sensor.rayCount / 2)] ||
            this.sensor.readings[Math.floor(this.sensor.rayCount / 2)].offset >
              0.4;
          if (frontClear) {
            this.controls.forward = Math.max(this.controls.forward, 0.6);
            this.controls.reverse = 0;
          }
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
