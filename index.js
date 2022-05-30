const dotenv = require('dotenv');
dotenv.config();

console.log(process.env.AWS_ACCESS_KEY)

exports.handler = async (event) => {
    console.log(JSON.stringify(event));
    console.log("Number of records in this event is ", event.Records.length);
    let RecordsSize = event.Records.length


    if (event.Records.length > 1 && event.Records.length != 0) {
        let ArrayOfEvenents = []
        //To spiliting the original event Records to single event
        let bigarray = event.Records;
        const sizePerArray = 1;
        for (var i = 0; i < bigarray.length; i += sizePerArray) {
            let handledEvent = {
                Records: []
            };
            handledEvent.Records = bigarray.slice(i, i + sizePerArray);
            ArrayOfEvenents.push(handledEvent);
        }
        // ArrayOfEvenents.forEach(async function (event) { 
        //   new Promise(async (resolve, reject) => { 
        //         let HundleOneEventAtAtimeResult = await HundleOneEventAtAtime(event);
        //         // console.log("HundleOneEventAtAtimeResult>>>",HundleOneEventAtAtimeResult);
        //         resolve(HundleOneEventAtAtimeResult);
        //     }); 
        // });
        if (ArrayOfEvenents.length == bigarray.length) {
            console.log("ArrayOfEvenents>>", JSON.stringify(ArrayOfEvenents));
            await Promise.all(ArrayOfEvenents.map(async (SingleEvent) => {
                // 	await HundleOneEventAtAtime(SingleEvent);
                // 	console.log("SingleEvent>>>",JSON.stringify(SingleEvent));
                let HundleOneEventAtAtimeResult = await HundleOneEventAtAtime(SingleEvent);
                console.log("HundleOneEventAtAtimeResult>>>", HundleOneEventAtAtimeResult);
                // resolve(HundleOneEventAtAtimeResult);                
            }));
        }

    } else {
        try {
            let HundleOneEventAtAtimeResult = await HundleOneEventAtAtime(event);
            console.log("HundleOneEventAtAtimeResult>>>", HundleOneEventAtAtimeResult)
        } catch (e) {
            console.log("Eroor >", e)
            // UpdateStatusToCertDynmoDB(event.Records[0].dynamodb.Keys.CertsId.S,"failed");
        }
    }
};