/**
 * Neural Network class for AI car decision making
 * Creates a multi-layer perceptron that processes sensor inputs and outputs driving controls
 * Architecture: Input Layer → Hidden Layer(s) → Output Layer
 * - Input: Sensor readings (distance to obstacles)
 * - Output: Driving controls (forward, left, right, reverse)
 
 
* @param {number[]} neuronCounts - Array defining neurons in each layer
* Example: [7, 12, 8, 4] = 7 inputs, 2 hidden layers (12,8), 4 outputs 

* @param {number[]} givenInputs - Input values (usually sensor readings) and 
* Input values from previous layer (in case of neural network computation)
* @param {NeuralNetwork} network - The network to process inputs through
* @returns {number[]} Final output values (driving controls)

* @param {NeuralNetwork} network - Network to mutate
* @param {number} amount - Mutation strength (0-1). Higher = more change

 * @param {Level} layer - The layer to process inputs through

*/

class NeuralNetwork {
  // Create a new neural network with specified layer sizes
  constructor(neuronCounts) {
    this.levels = []; // arrays to store all network levels

    // create connections between consecutive levels
    // If neuronCounts = [7, 12, 8, 4], creates 3 levels: 7→12, 12→8, 8→4
    for (let i = 0; i < neuronCounts.length - 1; i++) {
      this.levels.push(new Level(neuronCounts[i], neuronCounts[i + 1]));
    }
  }

  // Processes inputs through the entire network to get final outputs
  static feedforward(givenInputs, network) {
    // start with first level (inputs -> first hidden level)
    let outputs = Level.feedforward(givenInputs, network.levels[0]);

    // pass outputs through remaining levels sequentially
    // each level's output becomes the next level's input
    for (let i = 1; i < network.levels.length; i++) {
      outputs = Level.feedforward(outputs, network.levels[i]);
    }
    return outputs; // Final outputs: [forward, left, right, reverse]
  }

  // Mutates network weights and biases for genetic algorithm evolution
  static mutate(network, amount = 1) {
    network.levels.forEach((level) => {
      // mutate biases (decision thresholds for each neuron)
      for (let i = 0; i < level.biases.length; i++) {
        level.biases[i] = lerp(
          level.biases[i], // Current bias value
          Math.random() * 2 - 1, // Random value between -1 and 1
          amount // How much to change (mutation rate)
        );
      }

      // mutate weights (connection strengths between neurons)
      for (let i = 0; i < level.weights.length; i++) {
        for (let j = 0; j < level.weights[i].length; j++) {
          level.weights[i][j] = lerp(
            level.weights[i][j],
            Math.random() * 2 - 1,
            amount
          );
        }
      }
    });
  }
}

// Level class represents a single layer connection in the neural network
// Contains weights, biases, and activation function for neuron connections
class Level {
  constructor(inputNeuron, outputNeuron) {
    // arrays to store neurons values
    this.inputs = new Array(inputNeuron); // input values for previous layer
    this.outputs = new Array(outputNeuron); // output values to next layer
    this.biases = new Array(outputNeuron); // Decision thresholds for each output neuron

    // 2D array to store connection weights
    // weights[i][j] = strength of connection from input i to output j
    this.weights = [];
    for (let i = 0; i < inputNeuron; i++) {
      this.weights[i] = new Array(outputNeuron);
    }
    // Initialize with random values
    this.#randomize();
  }

  // IMPORTANT FUNCTION - Initializes weights and biases with random values
  // like giving random thought for choosing best weight
  #randomize() {
    // initialize all weights with random values between -1 and 1
    for (let i = 0; i < this.inputs.length; i++) {
      for (let j = 0; j < this.outputs.length; j++) {
        this.weights[i][j] = Math.random() * 2 - 1; // randomize between -1 and 1
        // [i][j]: row number (which input neuron {sender}) and Column number (which output neuron {receiver})
      }
    }
    // Initialize all biases with random values between -1 and 1
    for (let i = 0; i < this.biases.length; i++) {
      this.biases[i] = Math.random() * 2 - 1;
    }
  }

  // NEURAL NETWORK COMPUTATION LOGIC
  // Processes inputs through this level to produce outputs
  // Implements the core neural network computation: weighted sum + bias + activation
  static feedforward(givenInputs, level) {
    // store input values in the level
    for (let i = 0; i < level.inputs.length; i++) {
      level.inputs[i] = givenInputs[i];
    }

    // Calculate output for each output neuron
    for (let i = 0; i < level.outputs.length; i++) {
      let sum = 0;

      // calculate weighted sum: sum of (input * weight) for all connections
      for (let j = 0; j < level.inputs.length; j++) {
        sum += level.inputs[j] * level.weights[j][i];
      }

      // Apply bias and activation function
      // Bias shifts the activation threshold
      // tanh activation provides smooth, continuous outputs (-1 to 1)
      // This is better than binary (0/1) for smooth car control
      level.outputs[i] = Math.tanh(sum + level.biases[i]);
    }
    return level.outputs; // Return computed outputs
  }
}
