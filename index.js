const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.rpj9gts.mongodb.net/?retryWrites=true&w=majority`;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')


// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173','https://car-doctor-react-78cbe.web.app', 'https://car-doctor-react-78cbe.firebaseapp.com'],
  credentials: true
}));
app.use(cookieParser())


// Creating own middleware
const logger = async(req, res, next) => {
  console.log('called: ', req.hostname, req.method);
  next();
}
const VerifyToken = async(req, res, next) => {
  const token  = req.cookies?.token;
  // console.log('Value of token: ', token);
  if (!token) {
    return res.status(401).send({message:'Not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({message: 'Unauthorized'})
    }
    // console.log('value in the token: ', decoded);
    req.user = decoded;

  })
  next();
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true, 
      deprecationErrors: true,
    }
  });
  async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      // await client.connect(); 
        
      const serviceCollection = client.db('car-dr-db').collection('servicesCart')

      // Auth related api(How to generate a token using JWT ? )
      app.post('/jwt', async (req, res) => {
        const user = req.body
        // console.log(user);
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: '1h'
        })
        res.cookie('token', token, { 
          httpOnly: true, 
          secure: true, 
          sameSite: 'none'
        }).send({success: true})  
      })
      // User log out 
      app.post('/logout', async(req, res) => {
        const user  = req?.body; 
        console.log('logged out', user);
        res.clearCookie('token', {maxAge: 0}).send({success: true});
      })

      app.get('/services', logger, async(req, res) => {
        const cursor = await serviceCollection.find().toArray(); 
        res.send(cursor)
      })
      app.get('/services/:id', async(req, res) => {
        const id = req.params.id
        const query = {_id: new ObjectId(id)}
        const options = {
            projection: {title: 1, price: 1, service_id: 1 , img: 1}
        }
        const result = await serviceCollection.findOne(query, options)
        res.send(result)
        // console.log(result);
      })

    //   Send User booking info to database
    const bookingCollection = client.db('car-dr-db').collection('bookings')
    //! Load user booking data
    app.get('/bookings', logger, VerifyToken, async (req, res) => {
        // console.log(req.query.email);
        // console.log('Cookies',req.cookies);
        console.log('Validated token',req.user);
        if(req.query?.email !== req.user?.email) {
          return res.status(403).send({message: 'Forbidden access'})
        }
        let query = {}
        if(req.query?.email){
            query = {customerEmail: req.query?.email}
        }
        const result = await bookingCollection.find(query).toArray()  
        res.send(result);
    }) 
    app.post('/bookings', logger, async(req, res) => {
        const booking = req.body;
        // console.log(booking);
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
    })
    app.delete('/bookings/:id', async(req, res) => {   
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query); 
      res.send(result);
    })
    app.patch('/bookings/:id', async(req, res) => {
      const updatedBookings = req.body
      const id = req.params.id; 
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          status: updatedBookings.status
        }
      }
      // res.send(updatedDoc);
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result);
      console.log(updatedBookings); 
    })



      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error
    //   await client.close();
    }
  }
  run().catch(console.dir);   


app.get('/' , (req, res) => { 
    res.send('Server Running')
})
app.listen(port, () => {
    console.log(`Running in ${port}`);  
})