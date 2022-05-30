const { Worker } = require('worker_threads');
const dotenv = require('dotenv');
dotenv.config();

// console.log(process.env.AWS_ACCESS_KEY)

exports.handler = async (event, context) => {
    // Create a worker thread and pass to it the originalArray
    const worker = new Worker('./worker.js', {
        workerData: event.Records
    });

    // Receive messages from the worker thread
    worker.once('message', (hashedArray) => {
        console.log(hashedArray);

        // Do anything with the received hashedArray

    });
};





