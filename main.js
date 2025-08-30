const carCanvas = document.getElementById("carCanvas");
carCanvas.width = window.innerWidth; // Full width for track

const networkCanvas = document.getElementById("neuralNetworksCanvas");
networkCanvas.width = 500; // Larger size for center area

const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d");

// Set initial canvas height
carCanvas.height = window.innerHeight;
networkCanvas.height = 300; // Larger height for center area

console.log(
  "Network canvas size:",
  networkCanvas.width,
  "x",
  networkCanvas.height
);

const road = new Road(carCanvas.width / 2, 200, 3, "curved");
// Update road dimensions immediately after creation
road.updateDimensions(carCanvas.width, carCanvas.height);

// Simplified initialization for testing
let cars = [];
let traffic = [];
let bestCar = null;

// Initialize cars and traffic after a short delay to ensure road is ready
setTimeout(() => {
  const N = road.trackType === "curved" ? 50 : 1000;
  cars = generateCars(N);
  bestCar = cars[0];

  if (localStorage.getItem("bestBrain")) {
    for (let i = 0; i < cars.length; i++) {
      cars[i].brain = JSON.parse(localStorage.getItem("bestBrain"));
      if (i != 0) {
        // Reduced mutation rate for more stable learning
        // Use different mutation rates for diversity
        const mutationRate =
          i < cars.length * 0.1
            ? 0.05 // Top 10% - small mutations
            : i < cars.length * 0.3
            ? 0.15 // Next 20% - medium mutations
            : 0.25; // Rest - larger mutations for exploration
        NeuralNetwork.mutate(cars[i].brain, mutationRate);
      }
    }
  }

  initializeTraffic();
}, 100);

function initializeTraffic() {
  if (road.trackType === "curved") {
    // Create 7 DUMMY cars distributed across track and lanes
    traffic = [];
    try {
      const trafficPositions = [
        { lane: 0, t: 0, speed: 0.003 }, // Lane 0, start position
        { lane: 1, t: Math.PI / 4, speed: 0.004 }, // Lane 1, 1/8 around track
        { lane: 2, t: Math.PI / 2, speed: 0.0023 }, // Lane 2, 1/4 around track
        { lane: 0, t: (3 * Math.PI) / 4, speed: 0.0025 }, // Lane 0, 3/8 around track
        { lane: 1, t: Math.PI, speed: 0.0045 }, // Lane 1, halfway around
        { lane: 2, t: (5 * Math.PI) / 4, speed: 0.003 }, // Lane 2, 5/8 around track
        { lane: 1, t: (3 * Math.PI) / 2, speed: 0.004 }, // Lane 1, 3/4 around track
      ];

      for (let i = 0; i < trafficPositions.length; i++) {
        const config = trafficPositions[i];
        const position = road.getLaneCenter(config.lane, config.t);

        if (position && position.x && position.y) {
          // CAR SIZE CONFIGURATION: width=30, height=50 - modify these values to change car dimensions
          const trafficCar = new Car(
            position.x,
            position.y,
            30,
            50,
            "DUMMY",
            1
          ); // Reduced max speed by 0.1
          // Set DUMMY car properties for track following
          trafficCar.t = config.t;
          trafficCar.laneIndex = config.lane;
          trafficCar.trackspeed = config.speed; // Different speeds for variety

          // Calculate initial angle using forward direction
          const deltaT = 0.01;
          const nextT = (config.t + deltaT) % (2 * Math.PI);
          const nextPos = road.getLaneCenter(config.lane, nextT);

          // Calculate direction vector
          const dx = nextPos.x - position.x;
          const dy = nextPos.y - position.y;

          // Set angle in car's coordinate system
          if (Math.hypot(dx, dy) > 0.001) {
            trafficCar.angle = Math.atan2(dx, dy);
          } else {
            trafficCar.angle = -Math.PI / 2; // Default to facing right
          }

          traffic.push(trafficCar);
          console.log(
            `Traffic car ${i}: Lane ${config.lane}, t=${config.t.toFixed(
              2
            )}, speed=${config.speed}`
          );
        }
      }
    } catch (e) {
      console.log("Traffic initialization failed:", e);
      traffic = [];
    }
  } else {
    // Original straight road traffic
    // CAR SIZE CONFIGURATION: width=30, height=50 - modify these values to change car dimensions
    traffic = [
      new Car(road.getLaneCenter(0), -300, 30, 40, "DUMMY", 1.9), // Reduced max speed by 0.1
      new Car(road.getLaneCenter(2), -300, 30, 50, "DUMMY", 1.9), // Reduced max speed by 0.1
      new Car(road.getLaneCenter(1), -100, 30, 50, "DUMMY", 1.9), // Reduced max speed by 0.1
    ];
  }
}

animate();
drawNeuralNetwork();

function save() {
  localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
}

function discard() {
  localStorage.removeItem("bestBrain");
}

function generateCars(N) {
  const cars = [];
  for (let i = 1; i <= N; i++) {
    if (road.trackType === "curved") {
      // All AI cars start at the same position for fair comparison
      const startingLane = Math.floor(road.laneCount / 2); // Middle lane (lane 1 for 3-lane track)
      const startingT = 0; // Starting position (top of track)
      const position = road.getLaneCenter(startingLane, startingT);

      console.log(
        `AI Car ${i}: Starting at lane ${startingLane}, t=${startingT}, position:`,
        position
      );
      // AI CAR SIZE CONFIGURATION
      const car = new Car(position.x, position.y, 28, 50, "AI", 2.9); // Reduced max speed by 0.1

      // Set proper starting angle - cars should face right at t=0 (top straight)
      car.angle = -Math.PI / 2; // Face right in car's coordinate system

      // Add track parameter for fitness calculation
      car.t = startingT;
      car.laneIndex = startingLane;

      cars.push(car);
    } else {
      // CAR SIZE CONFIGURATION: width=30, height=50 - modify these values to change car dimensions
      cars.push(new Car(road.getLaneCenter(1), 100, 28, 50, "AI"));
    }
  }
  return cars;
}

function animate(time) {
  // Only update if cars are initialized
  if (cars && cars.length > 0) {
    for (let i = 0; i < traffic.length; i++) {
      traffic[i].update(road.borders, [], road);
    }

    for (let i = 0; i < cars.length; i++) {
      cars[i].update(road.borders, traffic, road);
    }

    if (road.trackType === "curved") {
      // For curved track, use fitness-based selection
      bestCar = cars.reduce((best, current) => {
        if (!best) return current;
        return current.fitness > best.fitness ? current : best;
      }, null);
    } else {
      // Original straight road logic
      bestCar = cars.find((c) => c.y == Math.min(...cars.map((c) => c.y)));
    }
  }

  // Only resize if window size actually changed
  if (
    carCanvas.height !== window.innerHeight ||
    carCanvas.width !== window.innerWidth
  ) {
    carCanvas.width = window.innerWidth;
    carCanvas.height = window.innerHeight;
    // Keep network canvas small and fixed

    // Update road dimensions for curved track
    if (road.trackType === "curved") {
      road.updateDimensions(carCanvas.width, carCanvas.height);
    }
  }

  // Clear the canvas before drawing
  carCtx.clearRect(0, 0, carCanvas.width, carCanvas.height);

  carCtx.save();

  if (road.trackType === "curved") {
    // For curved track, center the view on the track center
    carCtx.translate(
      -road.x + carCanvas.width / 2,
      -road.y + carCanvas.height / 2
    );
  } else {
    // Original straight road camera
    carCtx.translate(0, -bestCar.y + carCanvas.height * 0.7);
  }

  road.draw(carCtx);

  // Only draw cars if they exist
  if (cars && cars.length > 0) {
    for (let i = 0; i < traffic.length; i++) {
      traffic[i].draw(carCtx, "orange");
    }
    // Population cars
    carCtx.globalAlpha = 0.05;
    for (let i = 0; i < cars.length; i++) {
      cars[i].draw(carCtx, "#13132673");
    }

    carCtx.globalAlpha = 1;
    if (bestCar) {
      bestCar.draw(carCtx, "#00001a", true);
    }
  }

  carCtx.restore();

  requestAnimationFrame(animate);
}

// Draw neural network separately, outside the main animate function
function drawNeuralNetwork(time) {
  if (bestCar && bestCar.brain) {
    networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
    networkCtx.lineDashOffset = time / 50;
    Visualizer.drawNetwork(networkCtx, bestCar.brain);
  }
  requestAnimationFrame(drawNeuralNetwork);
}
