require("dotenv").config();
const { MongoClient } = require("mongodb");
const readlineSync = require("readline-sync");

const uri = process.env.MONGO_URI; // Loaded from .env

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("✅ Connected to Firestore (MongoDB compatible).");

    const db = client.db("default");
    const collection = db.collection("testCollection");

    const firstName = readlineSync.question("Enter first name: ");
    const lastName = readlineSync.question("Enter last name: ");

    const result = await collection.insertOne({ firstName, lastName, created_at: new Date() });
    console.log("✅ Document inserted with ID:", result.insertedId);

    console.log("\n📘 Documents in testCollection:");
    const docs = await collection.find().toArray();
    docs.forEach(doc => console.log(doc));
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.close();
  }
}

main();
