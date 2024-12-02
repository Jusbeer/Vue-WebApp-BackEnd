// Import dependencies
var express = require("express"); //handle routes and request
const PORT = process.env.PORT || 3000;
let app = express();
const cors = require("cors"); //useful when using different domain
app.use(cors()); // alows request from other domain like frontend file
app.use(express.json());
app.set("json spaces", 3); // JSON response formatting for debugging
const path = require('path');
let PropertiesReader = require("properties-reader"); //use to read the dbconnections.properties file
// Load the database properties which has been declared in the file dbconnection.properties
let propertiesPath = path.resolve(__dirname, "./dbconnection.properties");
let properties = PropertiesReader(propertiesPath);

// Extract values from the properties dbconnection.properties file
const dbPrefix = properties.get("db.prefix");
const dbHost = properties.get("db.host");
const dbName = properties.get("db.name");
const dbUser = properties.get("db.user");
const dbPassword = properties.get("db.password");
const dbParams = properties.get("db.params");


const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
// connecting with MongoDB using the extracted value
const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}${dbParams}`;
console.log(`MongoDB Connection URI: ${uri}`);

// Create a MongoClient
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1});

let db1;//declare variable

async function connect_to_DB() {
  try {
    client.connect();
    console.log('Connected to MongoDB');
    db1 = client.db(dbName);
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

connect_to_DB(); //call the connect_to_DB function to connect to MongoDB database

//taking the route's name as the name of rhe connection
app.param('collectionName', async function(req, res, next, collectionName) { 
    req.collection = db1.collection(collectionName);
    /*Check the collection name for debugging if error */
    console.log('Middleware set collection:', req.collection.collectionName);
    next();
});

// Serve static files from the Images folder
app.use("/images", express.static(path.join(__dirname, "Images")));

const imageMappings = {
  "Mathematics": "maths.webp",
  "Science": "science.webp",
  "English": "english.webp",
  "French": "french.webp",
  "Design & Tech": "design.webp",
  "Chemistry": "chemistry.webp",
  "Music": "music.webp",
  "Computer Science": "computer.webp",
  "Kendo": "kendo.webp",
  "Cooking": "cooking.webp",
  "Volleyball": "volley.webp",
};

// Serve the "Images" folder
async function updateLessonImages() {
  try {
    const lessonsCollection = db1.collection("courses"); // Use `db1` for MongoDB connection
    const lessons = await lessonsCollection.find({}).toArray();

    for (const lesson of lessons) {
      // Match the course name to its image file using the mapping
      const imageFileName = imageMappings[lesson.name];
      
      if (imageFileName) {
        const updatedImageURL = `http://localhost:${PORT}/images/${imageFileName}`;
        // Update the image field in the database
        await lessonsCollection.updateOne({_id: lesson._id},{ $set: {image: updatedImageURL}});
      } else {
        console.warn(`No image mapping found for course: ${lesson.name}`);
      }
    }

    console.log("Lesson images updated successfully!");
  } catch (error) {
    console.error("Error updating images:", error);
  }
}

// Update images after connecting to the database
connect_to_DB().then(() => updateLessonImages());

// Ensure this route is defined after the middleware app.param
// get all data from our collection in Mongodb
// whatever had ":" before the name is called a parameter, here it is the collection name
app.get('/collections/courses', async function (req, res, next) {
  try {
    //retrieving data from mongodb and storing it in an array
    const courses = await db1.collection('courses').find({}).toArray();

    //load the result from thje array on console to check if it works (for debugging purposes)
    console.log('Fetched courses:', courses);

    //respond back to front-end with the result
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error.message);
    next(error);
  }
});


// Fetch a single document by ID
app.get("/collections/:collectionName/:id", async (req, res, next) => {
  try {
    const result = await req.collection.findOne({ _id: new ObjectId(req.params.id) });
    console.log("Fetched document:", result);
    res.json(result);
  } catch (error) {
    console.error("Error fetching document:", error.message);
    next(error);
  }
});

// Insert a new document into a collection
app.post("/collections/:collectionName", async (req, res, next) => {
  try {
    const result = await req.collection.insertOne(req.body);
    console.log("Inserted document:", result);
    res.json(result);
  } catch (error) {
    console.error("Error inserting document:", error.message);
    next(error);
  }
});

// Update an existing document by ID
app.put("/collections/:collectionName/:id", async (req, res, next) => {
  try {
    const result = await req.collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    console.log("Updated document:", result);
    res.json(result.matchedCount === 1 ? { msg: "Success" } : { msg: "Error" });
  } catch (error) {
    console.error("Error updating document:", error.message);
    next(error);
  }
});

// Delete a document by ID
app.delete("/collections/:collectionName/:id", async (req, res, next) => {
  try {
    const result = await req.collection.deleteOne({ _id: new ObjectId(req.params.id) });
    console.log("Deleted document:", result);
    res.json(result.deletedCount === 1 ? { msg: "Success" } : { msg: "Error" });
  } catch (error) {
    console.error("Error deleting document:", error.message);
    next(error);
  }
});

// Update the course quantity and add to cart
app.put('/collections/courses/:id/add-to-cart', async (req, res) => {
  try {
      const courseId = req.params.id;
      const coursesCollection = db1.collection('courses');

      // Find and update the course to decrement its Space
      const result = await coursesCollection.updateOne(
          { _id: new ObjectId(courseId), Space: { $gt: 0 } }, // Ensure Space > 0
          { $inc: { Space: -1 } } // Decrement Space by 1
      );

      if (result.matchedCount === 0) {
          return res.status(400).json({ error: 'Course not found or no spaces left' });
      }

      // Add to cart logic (optional, if storing cart in the database)
      const cartCollection = db1.collection('cart'); // Assuming you have a cart collection
      const cartResult = await cartCollection.updateOne(
          { courseId: new ObjectId(courseId) },
          { $inc: { quantity: 1 } }, // Increment cart quantity
          { upsert: true } // Insert if it doesn't exist
      );

      res.json({ message: 'Course added to cart successfully', cartResult });
  } catch (error) {
      console.error('Error updating course:', error);
      res.status(500).json({ error: 'An error occurred while adding the course to the cart' });
  }
});

// Remove an item from the cart and increment the course quantity
app.put('/collections/courses/:id/remove-from-cart', async (req, res) => {
  try {
      const courseId = req.params.id;
      const coursesCollection = db1.collection('courses');

      // Increment the Space of the course
      const result = await coursesCollection.updateOne(
          { _id: new ObjectId(courseId) },
          { $inc: { Space: 1 } } // Increment Space by 1
      );

      if (result.matchedCount === 0) {
          return res.status(400).json({ error: 'Course not found' });
      }

      // Optional: Decrement the item in the cart collection
      const cartCollection = db1.collection('cart');
      const cartResult = await cartCollection.updateOne(
          { courseId: new ObjectId(courseId) },
          { $inc: { quantity: -1 } }, // Decrement cart quantity
          { upsert: false } // Do not insert if it doesn't exist
      );

      // Remove the item from the cart if the quantity reaches zero
      if (cartResult.modifiedCount > 0) {
          await cartCollection.deleteOne({ courseId: new ObjectId(courseId), quantity: { $lte: 0 } });
      }

      res.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
      console.error('Error removing item from cart:', error);
      res.status(500).json({ error: 'An error occurred while removing the item from the cart' });
  }
});



app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ error: 'An error occurred' });
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });