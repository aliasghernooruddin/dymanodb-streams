const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// console.log(process.env.AWS_ACCESS_KEY)

exports.handler = async (event, context) => {
    // console.log("Number of records in this event is ", event.Records.length);
    for (const element of event.Records) {
        const hash = crypto.createHmac('sha256', 'secret')
        .update(element.eventID)
        .digest('hex');
        
        console.log(hash)
    }

};
