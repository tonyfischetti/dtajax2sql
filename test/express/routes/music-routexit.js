import express from 'express';
import * as musicService from '../services/music-service.js';
export const musicRouter = express.Router();
//  TODO  use MAYBE
//
//  TODO CHANGED THIS !!!
musicRouter.get("/dtajax", (req, res) => {
  console.log("received ajax query");
  // console.log(JSON.stringify(req.query, null, 2));
  console.log(JSON.stringify(req.query));
  musicService.performAJAX(req.query).
    then((it) => {
      res.status(200).send(it);
    }).
    catch(e => {
      res.status(200).send({ error: e.message });
    });
});
