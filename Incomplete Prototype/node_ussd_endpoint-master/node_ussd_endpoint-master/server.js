const express = require('express')
const firebase = require('firebase')
var querystring = require('querystring');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json()

var app = express()
var http = require('http');
var config = {
    apiKey: "AIzaSyD40xrxzNlaZD9FlqdMjffMs5QIRQBnaKk",
    authDomain: "mymani-d2edb.firebaseapp.com",
    databaseURL: "https://mymani-d2edb.firebaseio.com",
    projectId: "mymani-d2edb",
    storageBucket: "mymani-d2edb.appspot.com",
    messagingSenderId: "1089876440715"
};
firebase.initializeApp(config);
var database = firebase.database();

//functions
function sendData(data) {
    var proxyRequest = http.get({
        host: 'localhost',
        port: 5500,
        method: 'GET',
        path: '/?menuOption=2&data=' + JSON.stringify(data)
    },
        function (proxyResponse) {
            proxyResponse.on('data', function (chunk) {
                console.log(chunk)
            });
        });
}
//listeners
database.ref("Vouchers").limitToFirst(1).on("value", (datasnapshot) => {
    if(datasnapshot)
    {
        for (var d in datasnapshot.toJSON()) {
            sendData(datasnapshot.toJSON()[d])
        }
    }
})

//routes
app.get("/startTransaction/:amount/:mechCellNo/:voucherNumber", (req, res) => {
    //get request parameters
    //query firebase to get that actual voucher
    //mech number,amount
    console.log("Merch request started")
    var proxyRequest = http.get({
        host: 'localhost',
        port: 5500,
        method: 'GET',
        path: '/?menuOption=5&data=' + JSON.stringify({ "amount": req.params.amount, "mechCellNo": req.params.merchantCellno, "voucherNumber": req.params.voucherNumber })
    },
        function (proxyResponse) {
            console.log("SMS sent, awaiting response....")
            newAmount = 0
            proxyResponse.on('data', function (chunk) {
                //this is a response from the sms guy.
                console.log("User responded to sms!")
    
                if (chunk.toString().split(':')[1].substring(0,2).toLowerCase() === "ok") {
                    console.log("User accepted  the transaction!")
                    //redeem amount from voucher --> need to select a specific voucher
                    var ref2 = database.ref("Vouchers").once("value", (snapsot) => {
                        for (var b in snapsot.toJSON()) {
                            var ref = database.ref("Vouchers").child(b).child("Amount")
                            ref.transaction((amount) => {
                                newAmount = amount - req.params.amount
                                return newAmount
                            })
                        }
                    }).then(() => {
                        console.log("Voucher redeemed successfully")
                        //top up user wallet.
                        var walletRef = database.ref("Wallets").child("Key").child("Balance")
                        walletRef.transaction((walletAmount) => {

                            return walletAmount += parseInt(req.params.amount)

                        }).then(() => {
                            //send customer success sms
                            var proxyRequest = http.get({
                                host: 'localhost',
                                port: 5500,
                                method: 'GET',
                                path: '/?menuOption=7&data=' + JSON.stringify({ "newAmount": newAmount })
                            }, (anotherResponse) => {
                                console.log("Transaction success sms sent!")        
                                anotherResponse.on('data', (data) => {
                                    console.log("Thanks for using our service")
                                })
                            })
                            //notify the merchant about the successful transaction
                            console.log("wallet topped up successfully")
                            res.send({ amountReceived: req.params.amount })
                        })
                    })
                }
                else {
                    res.send("Customer declined the request.try again!")
                }
            });
        });

})
app.listen(8000, () => {
    console.log("Server started at localhost 8000")
})
