const http = require('http');
const fs = require('fs');
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const path = require("path");

const downloadTemplate = function downloadFileUsingS3(link) {

    return new Promise(resolve => {
        const file = fs.createWriteStream('cerTemp.pptx');
        const request = http.get(link, function (response) {
            response.pipe(file);

            // after download completed close filestream
            file.on("finish", () => {
                file.close();
                console.log("Download Completed");
                resolve()
            });
        });
    })
}


const modifyTemplate = function modifyTemplate(filename, data) {

    // Load the docx file as binary content
    const content = fs.readFileSync(
        path.resolve(__dirname, filename),
        "binary"
    );

    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.render({
        UserName: data.UserName,
        WebinarName: data.WebinarName,
        Duration: data.Duration,
        Date: data.Date,
    });

    const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
    });


    fs.writeFileSync(path.resolve(__dirname, "output.pptx"), buf);
}


module.exports = {
    downloadTemplate, modifyTemplate
}