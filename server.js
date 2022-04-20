const axios = require('axios')
const cheerio = require('cheerio')
const { writeDb, readDb } = require('./dbFunctions')
const express = require('express')
const app = express()
const port = process.env.PORT || 8383

app.use(express.static('public'))

const urls = ['learnprogramming', 'webdev', 'cscareerquestions']
const baseUrl = 'https://www.reddit.com/r/'
// const interval = 900000 //5s
const interval = 300000 //5s

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')

const serviceAccount = require('./public/creds.json');

initializeApp({
    credential: cert(serviceAccount)
})

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore()

const storedData = {}

function cron(ms, fn) {
    async function cb() {
        clearTimeout(timeout)
        await fn()
        setTimeout(cb, ms)
    }
    let timeout = setTimeout(cb, ms)
    return () => { }
}

async function run() {
    const data = await Promise.all(urls.map(async url => { //returns an array of objects
        try {
            const { data } = await axios.get(baseUrl + url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36'
                }
            })
            const $ = cheerio.load(data)

            const activity = $('div[data-testid="subreddit-sidebar"] div:first-child div:last-child div:nth-child(2) div:nth-child(2)').get()[0]
            const num = parseInt($(activity).text().replaceAll('Online', '').replaceAll(',', '').replaceAll('k', '00').replaceAll('.', ''))
            console.log(num)
            return { [url]: num }
        } catch (err) {
            return { [url]: null }
            console.log(err.message)
        }
    }))
    console.log(data)

    // const storedData = readDb() ? readDb() : {}

    data.forEach(async website => {
        const key = Object.keys(website)[0]
        const docRef = db.collection('activity').doc(`${key}`)
        // if (key in storedData) {
        //     storedData[key] = {
        //         ...storedData[key],
        //         [new Date()]: website[key]
        //     }
        //     return
        // }
        // storedData[key] = {
        //     [new Date()]: website[key]
        // }
        const res = await docRef.set({
            [new Date()]: website[key]
        }, {
            merge: true
        });
    })
    // console.log(storedData)
    // writeDb(storedData)
}

cron(interval, run)

//routes
app.get('/', (req, res) => {
    res.status(200).send({ message: 'Please include subreddit in the form url/api/<subreddit>' })
})

app.get('/api/tracked', (req, res) => {
    res.status(200).send({ subs: urls })
})

app.get('/test', async (req, res) => {
    try {
        const { data: html } = await axios.get('https://www.reddit.com/r/learnprogramming')
        const $ = cheerio.load(html)
        res.status(200).send($.html())
    } catch (err) {
        res.status(500).send({ message: err.message })
    }
})

app.get('/api/:subreddit', async (req, res) => {
    const { subreddit } = req.params
    const { api_key } = req.query
    console.log('hello', subreddit)
    // const data = readDb()
    // const data = storedData
    if (api_key !== 'james') {
        return res.status(400).send({ message: "Please use API key" })
    }

    const docRef = db.collection('activity').doc(subreddit)
    const doc = await docRef.get()

    // if (!Object.keys(data).includes(subreddit)) {
    //     return res.status(400).send({ message: 'Subreddit not tracked' })
    // }
    if (!doc.exists) {
        return res.status(400).send({ message: 'Subreddit not tracked' })
    }

    // res.status(200).send({ [subreddit]: data[subreddit] })
    res.status(200).send({ [subreddit]: doc.data() })
})

app.listen(port, () => console.log(`Server has started on port: ${port}`))