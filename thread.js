const { Worker } = require('worker_threads');

const originalArray = Array(50000).fill('my name is Khan');

// Create a worker thread and pass to it the originalArray
const worker = new Worker('./worker.js', {
    workerData: originalArray
});

// Receive messages from the worker thread
worker.once('message', (hashedArray) => {
    console.log( hashedArray);

    // Do anything with the received hashedArray

});
