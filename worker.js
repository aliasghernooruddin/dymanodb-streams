// worker.js
const { parentPort, workerData } = require('worker_threads');
const utils = require("./utils.js")

const hashedArray = [];
let length = workerData.length < 10 ? workerData.length : 10
let records = workerData.slice(0, length)

for (const element of records) {

	try {
		var marshalled = AWS.DynamoDB.Converter.unmarshall(element.dynamodb.NewImage);
		var arrData = marshalled.ArrData[0]
		var authInfo = marshalled.AuthInfo

		if (element.eventName == 'INSERT' && marshalled.CertStatus == "pending") {
			await utils.downloadTemplate(marshalled.eventCertTemplateURL)
			await utils.modifyTemplate('cerTemp.pptx', arrData['certsdata'])
			let url = await utils.cloudConvertToPDF('output.pptx')
			await utils.uploadToS3(url, arrData['generalinfo'], arrData['certsdata'].UserName)

			let obj = {
				user_id: arrData['generalinfo'].user_id,
				BearerAuthToken: authInfo.BearerAuthToken,
				clienthostname: authInfo.clienthostname,
				service_id: arrData['generalinfo'].service_id,
				PDFCertURL: url
			}

			await utils.addCertificateToDB(marshalled.CertsId, obj)
		} else if (element.eventName == 'MODIFY' && marshalled.CertStatus == "generated") {
		
			let obj = {
				user_id: arrData['generalinfo'].user_id,
				service_id: arrData['generalinfo'].service_id,
				pdf: arrData['generalinfo'].PDFCertURL
			}

			obj = JSON.stringify([obj])

			await utils.saveToLocalDB(obj, authInfo.clienthostname, authInfo.BearerAuthToken)
		} else {
			console.log("No futher steps required")
		}
	} catch (err) {
		console.log(err)
	}

	hashedArray.push('Task Successfully completed');
}

// Send the hashedArray to the parent thread
parentPort.postMessage(hashedArray);
process.exit()