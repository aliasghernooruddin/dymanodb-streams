const { Worker } = require('worker_threads');

exports.handler = async (event, context) => {
    // Create a worker thread and pass to it the originalArray
    const worker = new Worker('./worker.js', {
        workerData: event.Records
    });

    // Receive messages from the worker thread
    worker.once('message', (hashedArray) => {
        console.log(hashedArray);
    });

    worker.on("error", error => {
        console.log(error);
    });

    worker.on("exit", exitCode => {
        console.log(exitCode);
    });
};



// const { Worker } = require('worker_threads');

// exports.handler = async (event, context) => {

//     let numberOfThreads = 2;
//     const workerArray = [];
//     for (let n = 0; n < numberOfThreads; n++) {
//         let worker = new Worker('./worker.js', {
//             workerData: event.Records
//         });
//         workerArray.push(worker)
//     }
//     workerArray[0].on('message', (hashedArray) => {
//         console.log(hashedArray);
//     });
//     workerArray[0].on('error', (hashedArray) => {
//         console.log(hashedArray);
//     });
//     workerArray[0].on('exit', (hashedArray) => {
//         console.log(hashedArray);
//     });
//     workerArray[0].once('message', (hashedArray) => {
//         console.log(hashedArray);
//     });
//     workerArray[0].once('error', (hashedArray) => {
//         console.log(hashedArray);
//     });
//     workerArray[0].once('exit', (hashedArray) => {
//         console.log(hashedArray);
//     });
// };