const AWS = require('aws-sdk');
const utils = require("./utils.js")

exports.handler = async (event, context) => {

    let length = event.Records.length < 10 ? event.Records.length : 10
    let records = event.Records.slice(0, length)

    for (const element of records) {
        try {
            var marshalled = AWS.DynamoDB.Converter.unmarshall(element.dynamodb.NewImage);
            var arrData = marshalled.ArrData[0]

            if (element.eventName == 'INSERT' && marshalled.CertStatus == "pending") {
                await utils.downloadTemplate(marshalled.eventCertTemplateURL)
                await utils.modifyTemplate('cerTemp.pptx', arrData['certsdata'])
                let url = await utils.cloudConvertToPDF('output.pptx')
                await utils.uploadToS3(url, arrData['generalinfo'], arrData['certsdata'].UserName)

                let obj = {
                    user_id: arrData['generalinfo'].user_id,
                    BearerAuthToken: marshalled.AuthInfo.BearerAuthToken,
                    clienthostname: marshalled.AuthInfo.clienthostname,
                    service_id: arrData['generalinfo'].service_id,
                    PDFCertURL: url
                }

                await utils.addCertificateToDB(marshalled.CertsId, obj)
            }
            else if (element.eventName == 'MODIFY' && element.CertStatus == "generated") {

                let obj = {
                    user_id: arrData['generalinfo'].user_id,
                    service_id: arrData['generalinfo'].service_id,
                    pdf: arrData['generalinfo'].PDFCertURL
                }

                obj = JSON.stringify([obj])

                await utils.saveToLocalDB(obj, obj.clienthostname, obj.BearerAuthToken)
            } else {
                console.log("No futher steps required")
            }
        } catch (err) {
            console.log(err)
        }
    }
    return context.logStreamName
};
