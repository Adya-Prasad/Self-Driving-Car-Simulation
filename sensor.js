/*
STEP 1: Sensors detect obstacles
sensor.readings = [
  {offset: 0.8},  // Ray 0: obstacle at 80% distance
  {offset: 0.3},  // Ray 1: obstacle at 30% distance  
  null,           // Ray 2: no obstacle
  {offset: 0.9},  // Ray 3: obstacle at 90% distance
  null,           // Ray 4: no obstacle
  {offset: 0.1},  // Ray 5: obstacle very close!
  {offset: 0.7}   // Ray 6: obstacle at 70% distance
];

STEP 2: Convert to neural network inputs
const inputs = sensor.readings.map(s => s == null ? 0 : 1 - s.offset);
Result: [0.2, 0.7, 0, 0.1, 0, 0.9, 0.3]
Higher values = closer obstacles = more urgent!
*/

class Sensor {
  constructor(car) {
    this.car = car;
    this.rayCount = 9; // Increased for better obstacle detection
    this.rayLength = 180; // Reduced for more responsive reactions
    this.raySpread = Math.PI * 0.75; // Wider field of view 

    this.rays = []; // Array to store beam positions
    this.readings = [];  // Array to store what sensor ray detect
  }

  update(roadBorders, traffic) {
    this.#castRays(); // Step 1: Shoot the laser beams
    this.readings = []; // Step 2: Clear previous readings
    for (let i = 0; i < this.rays.length; i++) {
      // Step 3: Check what each beam hits
      this.readings.push(this.#getReading(this.rays[i], roadBorders, traffic));
    }
  }

  #getReading(ray, roadBorders, traffic) {
    let touches = [];

    // Check collisions with road borders
    for (let i = 0; i < roadBorders.length; i++) {
      const touch = getIntersection(
        ray[0],
        ray[1],
        roadBorders[i][0],
        roadBorders[i][1]
      );
      if (touch) {
        touches.push(touch);
      }
    }

    // Check collisions with traffic cars
    for (let i = 0; i < traffic.length; i++) {
      const poly = traffic[i].polygon;
      for (let j = 0; j < poly.length; j++) {
        const value = getIntersection(
          ray[0],
          ray[1],
          poly[j],
          poly[(j + 1) % poly.length]
        );
        if (value) {
          touches.push(value);
        }
      }
    }

    // Return closest obstacle
    if (touches.length == 0) {
      return null;
    } else {
      const offsets = touches.map((e) => e.offset);
      const minOffset = Math.min(...offsets);
      return touches.find((e) => e.offset == minOffset); // Closest obstacle
    }
  }

  #castRays() {
    this.rays = [];
    for (let i = 0; i < this.rayCount; i++) {
      const rayAngle =
        lerp(
          this.raySpread / 2, // +45° (right side)
          -this.raySpread / 2,  // -45° (left side)  
          this.rayCount == 1 ? 0.5 : i / (this.rayCount - 1)
        ) + this.car.angle; // add car's rotation

      const start = { x: this.car.x, y: this.car.y };
      const end = {
        x: this.car.x - Math.sin(rayAngle) * this.rayLength,
        y: this.car.y - Math.cos(rayAngle) * this.rayLength,
      };
      this.rays.push([start, end]); // Store beam as [start_point, end_point]
    }
  }

  // Visualizing the Vision (sensors)
  draw(ctx) {
    for (let i = 0; i < this.rayCount; i++) {
      let end = this.rays[i][1];
      if (this.readings[i]) {
        end = this.readings[i];  // If hit something: stop there
      }

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffff008c";
      ctx.moveTo(this.rays[i][0].x, this.rays[i][0].y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff0707b4";
      ctx.moveTo(this.rays[i][1].x, this.rays[i][1].y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }
}
