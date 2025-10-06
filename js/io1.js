/* io1.js (Complete & Corrected) */
// START CHUNK: File Upload Handler
async function handleFileUpload(event) {
    const file = event.target.files && event.target.files[0]; // Ensure files array exists
    const customFileLabel = document.querySelector('.custom-file-label[for="csvFileUploader"]');

    if (!file) {
        showToast("No File", "No file selected.", "info");
        if (customFileLabel) customFileLabel.textContent = "Append CSV/JSON";
        return;
    }

    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.csv', '.json'];
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
        showToast("Invalid File Type", "Please select a .csv or .json file.", "error");
        if (customFileLabel) customFileLabel.textContent = "Append CSV/JSON";
        if (event.target) event.target.value = null; // Clear file input
        return;
    }

    if (customFileLabel) customFileLabel.textContent = file.name;

    showLoading("Analyzing uploaded file...");
    const reader = new FileReader();
    reader.onload = async function(e) {
        const fileContent = e.target.result;
        try {
            let parsedDataFromFile;
            
            if (fileExtension === '.csv') {
                const results = await new Promise((resolve, reject) => {
                    Papa.parse(fileContent, {
                        header: true, skipEmptyLines: true, dynamicTyping: false,
                        complete: (res) => resolve(res),
                        error: (err) => reject(err)
                    });
                });
                if (results.errors && results.errors.length > 0) {
                    const firstError = results.errors[0];
                    throw new Error(`CSV Parsing Error in ${file.name} (Row ${firstError.row || 'N/A'}): ${firstError.message}.`);
                }
                parsedDataFromFile = results.data;
            } else if (fileExtension === '.json') {
                parsedDataFromFile = JSON.parse(fileContent);
                if (!Array.isArray(parsedDataFromFile)) {
                    if (typeof parsedDataFromFile === 'object' && parsedDataFromFile !== null) {
                        const keys = Object.keys(parsedDataFromFile);
                        if (keys.length === 1 && Array.isArray(parsedDataFromFile[keys[0]])) {
                            parsedDataFromFile = parsedDataFromFile[keys[0]];
                        } else {
                            throw new Error("JSON file must be an array of movie objects.");
                        }
                    } else {
                         throw new Error("JSON file must be an array of movie objects.");
                    }
                }
            } else {
                throw new Error("Unsupported file type.");
            }
            
            // <<-- MODIFIED -->>
            // Instead of directly processing, we initiate the smart import flow
            await initiateSmartImport(parsedDataFromFile, file.name);

        } catch (err) {
            console.error("File processing error:", err);
            showToast("File Error", `Processing error: ${err.message}. Check console for details.`, "error", 6000);
            if (customFileLabel) customFileLabel.textContent = "Append CSV/JSON";
        } finally {
            // Loading is hidden inside the smart import logic now
            if (event.target) event.target.value = null;
        }
    };
    reader.onerror = () => {
        showToast("File Read Error", "Could not read the selected file.", "error");
        if (customFileLabel) customFileLabel.textContent = "Append CSV/JSON";
        hideLoading();
        if (event.target) event.target.value = null;
    };
    reader.readAsText(file);
}
// END CHUNK: File Upload Handler