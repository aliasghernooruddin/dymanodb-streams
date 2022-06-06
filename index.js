const AWS = require('aws-sdk');
const utils = require("./utils.js")

exports.handler = async (event, context) => {

    let length = event.Records.length < 10 ? event.Records.length : 10
    let records = event.Records.slice(0, length)

    for (const element of records) {

        var marshalled = AWS.DynamoDB.Converter.unmarshall(element.dynamodb.NewImage);

        if (element.eventName == 'INSERT' && marshalled.CertStatus == "pending") {
            await utils.downloadTemplate(marshalled.eventCertTemplateURL)
            await utils.modifyTemplate('cerTemp.pptx', marshalled.ArrData[0]['certsdata'])
            let url = await utils.cloudConvertToPDF('output.pptx')
            await utils.uploadToS3(url, marshalled.ArrData[0]['generalinfo'], marshalled.ArrData[0]['certsdata'].UserName)
            let obj = {
                user_id: marshalled.ArrData[0]['generalinfo'].user_id,
                BearerAuthToken: marshalled.AuthInfo.BearerAuthToken,
                clienthostname: marshalled.AuthInfo.clienthostname,
                service_id: marshalled.ArrData[0]['generalinfo'].service_id,
                PDFCertURL: url
            }
            await utils.addCertificateToDB(marshalled.CertsId, obj)

        }
        else if (element.eventName == 'MODIFY' && element.CertStatus == "generated") {
            let obj = {
                user_id: marshalled.ArrData[0]['generalinfo'].user_id,
                service_id: marshalled.ArrData[0]['generalinfo'].service_id,
                pdf: marshalled.ArrData[0]['generalinfo'].PDFCertURL
            }
            obj = JSON.stringify([obj])
            await utils.saveToLocalDB(obj, obj.clienthostname, obj.BearerAuthToken)
        } else {
            console.log("No futher steps required")
        }

    }

};
