require('dd-trace').init();

const axios = require('axios');
const express = require('express')
const app = express()
const port = 3000

app.get('/', async (req, res) => {
  try {
    if (req.query.badHeader !== undefined) {
      await axios.get('https://httpbin.org/get', { headers: { BadHeader: 'a\nb' } })
    }

    if (req.query.error !== undefined) {
      await axios.get('https://httpbin.org/status/500')
    }

    res.json({});
  } catch (error) {
    res.status(500).send(error.message);
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
