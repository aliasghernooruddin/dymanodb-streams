const dotenv = require('dotenv');
var AWS = require('aws-sdk');
var path = require('path');

const utils = require("./utils.js")

dotenv.config();

// console.log(process.env.AWS_ACCESS_KEY)

exports.handler = async (event, context) => {
    console.log("Number of records in this event is ", event.Records.length);

    for (const element of event.Records) {
        var marshalled = AWS.DynamoDB.Converter.unmarshall(element.dynamodb.NewImage);
        if (element.eventName == 'INSERT' && marshalled.CertStatus == "pending") {
            await utils.modifyTemplate('cerTemp.pptx', marshalled.ArrData[0]['certsdata'])
            await utils.downloadTemplate(marshalled.eventCertTemplateURL)
        }
        else if (element.eventName == 'MODIFY' && element.CertStatus == "generated") {

        }

    }

};
