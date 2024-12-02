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



// Ensure this route is defined after the middleware app.param
// get all data from our collection in Mongodb
// whatever had ":" before the name is called a parameter, here it is the collection name
app.get('/collections/:collectionName', async function(req, res, next) {
  try{
    //retrieving data from mongodb and storing it in an array
    const results= await req.collection.find({}).toArray();

    //load the result from thje array on console to check if it works (for debugging purposes)
    console.log('Retrieve data:', results);

    //respond back to front-end with the result
    res.json(results);
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
  }
    
});

app.get('/collections1/:collectionName', async function(req, res, next) {
  try{
    const results= await req.collection.find({},{limit:10, sort: {price:-1}}).toArray();

    console.log('Retrieve data:', results);

    res.json(results);
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
  }
 
});
//sorting
app.get('/collections/:collectionName/:max/:sortAspect/:sortAscDesc', async function(req, res, next){
  try{
    var max = parseInt(req.params.max, 10);
    let sortDirection = 1;
    if(req.params.sortAscDesc ==="desc"){
      sortDirection = -1;
    }

    const results= await req.collection.find({},{limit:max, sort: {[req.params.sortAspect]: sortDirection}}).toArray();

    console.log('Retrieve data:', results);

    res.json(results);
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
  }
    
});

//searching by id
app.get('/collections/:collectionName/:id' , async function(req, res, next) {
  try{
    const results= await req.collection.findOne({_id:new ObjectId(req.params.id) });

    console.log('Retrieve data:', results);

    res.json(results);
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
  }
    
});

app.post('/collections/:collectionName', async function(req, res, next) {
  try{

    // log the request that body
    console.log('Received Request : ', req.body);

    //in post we won't use .find, we will use .insert
    const results= await req.collection.insertOne(req.body);

    console.log('Inserted document:', results);

    res.json(results);
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
  }
    
});

app.delete('/collections/:collectionName/:id', async function(req, res, next) {
  try{

    console.log('Received Request : ', req.params.id);
    const results= await req.collection.deleteOne({_id:new ObjectId(req.params.id) });

    console.log('Deleted data:', results);

    res.json((results.deletedCount === 1) ? {msg: "Success"} : {msg: "error"});
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
  }
    
});

app.put('/collections/:collectionName/:id', async function(req, res, next) {
  try{

    console.log('Received Request : ', req.params.id);
    const results= await req.collection.updateOne({_id:new ObjectId(req.params.id) }, {$set:req.body} );

    console.log('Updated data:', results);

    res.json((results.matchedCount === 1) ? {msg: "Success"} : {msg: "error"});
  }
  catch(err){
    console.error('Error Fetching docs', err.message);
    next(err);
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