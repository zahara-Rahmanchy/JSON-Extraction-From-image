const express = require('express');
const Jimp = require('jimp').default;
const Tesseract = require('tesseract.js');
const cors = require('cors');

const app = express();

const corsOptions = {
  origin: 'https://json-extraction-challenge.intellixio.com',
  credentials: true,
  optionSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(express.json({ limit: '10mb' }));
app.use(cors(corsOptions));
// app.options('*', cors(corsOptions));
app.get('/', (req, res) => {
  res.send('Hello from JSON Extraction API!');
});

app.post('/extract-json', async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({
      success: false,
      message: 'imageBase64 field is required',
    });
  }

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const jsonData = await extractJSONFromImage(buffer);
    console.log("sjaon: ",jsonData)
   
    res.json({
      success: true,
      data: {
        name:jsonData?.name,
        organization:jsonData?.organization,
        address:jsonData?.address,
        mobile:jsonData?.mobile
      },
      message: 'Successfully extracted JSON from image',
    });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to extract JSON: ' + err.message,
    });
  }
});

async function extractJSONFromImage(buffer) {
  const image = await Jimp.read(buffer);
  // image.greyscale().resize(2000, Jimp.AUTO);
  image
  .greyscale()
  .contrast(0.5)         // increase contrast
  .normalize()           // normalize brightness/contrast
  .resize(2000, Jimp.AUTO) // keep upscale
  .quality(100);         // keep JPEG/PNG quality high

  // Convert Jimp image to PNG buffer
  const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

  // Run OCR on the processed buffer
  const { data: { text } } = await Tesseract.recognize(processedBuffer, 'eng',
     {
    tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ,.- x'  // Whitelist for characters
  });
 
  
  console.log('Extracted text:', text);
  if (!text || text.trim() === '') {
    throw new Error('No text found in image');
  }
  const cleanedText = text
  .replace(/[“”]/g, '"') 
  .replace(/€/g, '')   
  .replace(/;/g, ':')  
  .trim();

  const regex = /"(name|organization|address|mobile)":\s*"([^"]*)"/g;

  // Initialize result object to store extracted values
  let result = {};
  
  // Match all occurrences of the keys and their values
  let match;
  while ((match = regex.exec(cleanedText)) !== null) {
    const key = match[1];    
    const value = match[2]; 
  
    result[key] = value;
  }
  
  console.log('Extracted values:', result); 
  return result;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
