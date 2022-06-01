const AWS = require('aws-sdk');
const utils = require("./utils.js")

exports.handler = async (event, context) => {

    let length = event.Records.length < 10 ? event.Records.length : 10
    records = event.Records.slice(0, 5)

    for (const element of records) {
        var marshalled = AWS.DynamoDB.Converter.unmarshall(element.dynamodb.NewImage);
        if (element.eventName == 'INSERT' && marshalled.CertStatus == "pending") {
            await utils.downloadTemplate(marshalled.eventCertTemplateURL)
            await utils.modifyTemplate('cerTemp.pptx', marshalled.ArrData[0]['certsdata'])
            let url = await utils.cloudConvertToPDF('output.pptx')
            await utils.uploadToS3(url, marshalled.ArrData[0]['generalinfo'], marshalled.ArrData[0]['certsdata'].UserName)
        }
        else if (element.eventName == 'MODIFY' && element.CertStatus == "generated") {

        }

    }

};
