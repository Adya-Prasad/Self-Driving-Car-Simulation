const carCanvas = document.getElementById("carCanvas");
carCanvas.width = window.innerWidth; // full width for road track

const networkCanvas = document.getElementById("neuralNetworksCanvas");
networkCanvas.width = 600; // Neural Network width

const carCtx = carCanvas.getContext("2d"); // 2d rendering, returns: CanvasRenderingContext2D
const networkCtx = networkCanvas.getContext("2d");

// neural network canvas height
carCanvas.height = window.innerHeight;
networkCanvas.height = 400; 

// create road with some initital values
const road = new Road(carCanvas.width / 2, 200, 3, "curved");
// update road dimension immediately after creation
road.updateDimensions(carCanvas.width, carCanvas.height);

// initialization
let cars=[]
let traffic=[]
let bestCar=null;

// Initialize cars and traffic after a short delay to ensure road is ready
setTimeout(() => {
    // spawned 80 AI cars population on road tracks (could be adjust)
    cars = generateCars(80);
    bestCar = cars[0];

    if (localStorage.getItem("bestBrain")) {
        for(let i=0; i<cars.length; i++){
            cars[i].brain = JSON.parse(localStorage.getItem("bestBrain"));
            if(i != 0){
                // OPTIMIZED mutation strategy for better learning stability
                // Reduced mutation rates for smoother learning progression
                // Elite preservation + graduated mutation for exploration
                const mutationRate = i < cars.length * 0.05 ? 0.02 :  // Top 5% - minimal changes
                                   i < cars.length * 0.15 ? 0.08 :  // Next 10% - small changes
                                   i < cars.length * 0.4 ? 0.15 :   // Next 25% - moderate changes
                                   0.22;                             // Rest 60% - larger exploration
                NeuralNetwork.mutate(cars[i].brain, mutationRate)
            }
        }
    }
    initializeTraffic();
}, 100);

function initializeTraffic() {
    if (road.trackType === "curved"){
        traffic = []; // no of DUMMY cars to create and distribute on road
        try {
            const trafficPosition = [
                { lane: 0, t: 0, speed: 0.003 }, // Lane 0, start position
                { lane: 1, t: Math.PI / 4, speed: 0.0025 }, // Lane 1, 1/8 around track
                { lane: 2, t: Math.PI / 2, speed: 0.0035 }, // Lane 2, 1/4 around track
                { lane: 0, t: (3 * Math.PI) / 4, speed: 0.0025 }, // Lane 0, 3/8 around track
                { lane: 1, t: Math.PI, speed: 0.0041 }, // Lane 1, halfway around
                { lane: 2, t: (5 * Math.PI) / 4, speed: 0.0035 }, // Lane 2, 5/8 around track
                { lane: 1, t: (3 * Math.PI) / 2, speed: 0.0041 }, // Lane 1, 3/4 around track
            ];
            for (let i=0; i<trafficPosition.length; i++){
                const config = trafficPosition[i];
                const position = road.getLaneCenter(config.lane, config.t);

                if(position && position.x && position.y){
                    // DUMMY car size CONFIGURATION: width=30, height=50
                    const trafficCar = new Car(position.x, position.y, 30, 50, "DUMMY", 1);
                    // set DUMMMY car properties for tracks
                    trafficCar.t=config.t;
                    trafficCar.laneIndex=config.lane;
                    trafficCar.trackspeed=config.speed; // different speeds for variety

                    // calculate initial angle using forward direction
                    const deltaT = 0.01;
                    const nextT = (config.t + deltaT) % (2 * Math.PI);
                    const nextPos = road.getLaneCenter(config.lane, nextT);

                    // set angle in car's coordinate system
                    const dx = nextPos.x - position.x;
                    const dy = nextPos.y - position.y;

                    // set angle in car's coordinate system
                    if(Math.hypot(dx, dy) > 0.001){
                        trafficCar.angle = Math.atan2(dx, dy);
                    } else{
                        trafficCar.angle= -Math.PI/2; // default to facing right
                    }
                    traffic.push(trafficCar);
                    console.log(
                        `Traffic car ${i}: Lane ${config.lane}, t=${config.t.toFixed(2)}, speed=${config.speed}`);
                }

            }
        
        } catch (e){
            console.log("Traffic initialization failed:", e);
            traffic =[];
        }
    } else{
        // Original straight road traffic
         // CAR SIZE CONFIGURATION: width=30, height=50
         traffic = [
            new Car(road.getLaneCenter(0), -300, 30, 40, "DUMMY", 1.9),
            new Car(road.getLaneCenter(1), -400, 30, 40, "DUMMY", 1.9),
            new Car(road.getLaneCenter(2), -250, 30, 40, "DUMMY", 1.9),
         ];
        }
}
animate();
drawNeuralNetwork();

function save(){
    localStorage.setItem("bestBrain", JSON.stringify(bestCar.brain));
}

function discard(){
    localStorage.removeItem("bestBrain")
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
    // Only update if cars are intialized
    if (cars  && cars.length > 0){
        for(let i=0; i<traffic.length; i++){
            traffic[i].update(road.borders, [], road);
        }
        for (let i=0;  i<cars.length; i++){
            cars[i].update(road.borders, traffic, road);
        }
        if (road.trackType === "curved"){
            // OPTIMIZED: Stable best car selection with hysteresis to reduce flickering
            const currentBest = cars.reduce((best, current) => {
                if (!best) return current;
                return current.fitness > best.fitness ? current : best;
            }, null);
            
            // Only change best car if new candidate is significantly better (hysteresis)
            const improvementThreshold = bestCar ? bestCar.fitness * 1.05 : 0; // 5% improvement required
            if (!bestCar || currentBest.fitness > improvementThreshold) {
                bestCar = currentBest;
            }
        } else {
            // original straight road logic
            bestCar = cars.find((c) => c.y == Math.min(...cars.map((c) => c.y)));
        }
    }
    // Only resize if window size actually changed
    if (carCanvas.height != window.innerHeight || carCanvas.width != window.innerWidth){
        carCanvas.width = window.innerWidth;
        carCanvas.height = window.innerHeight;

        // keep network canvas small and fixed
        //  update road dimension for curved track
        if(road.trackType === "curved"){
            road.updateDimensions(carCanvas.width, carCanvas.height);
        }
    }
    // clear the canvas before drawing
    carCtx.clearRect(0, 0, carCanvas.width, carCanvas.height);

    carCtx.save();

    if(road.trackType === "curved"){
        // for curved track, center the view on the track center
        // Move left by the road's center X position, then move right by half the screen width
        carCtx.translate(-road.x + carCanvas.width /2,-road.y +  carCanvas.height /2);
    } else{
        // original straight road camera
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

// draw neural network separately, outside the main animate function
function drawNeuralNetwork(time){
    if(bestCar && bestCar.brain){
        networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
        networkCtx.lineDashOffset = time / 50;
        Visualizer.drawNetwork(networkCtx, bestCar.brain);
    }
    requestAnimationFrame(drawNeuralNetwork);
}

// Some console logging for better testing
console.log("Network canvas size:",networkCanvas.width, "x", networkCanvas.height);