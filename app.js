const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
let length = null;
const path = require("path");
const jwt = require("jsonwebtoken");

const a = 10;

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "TWITTERCLONE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const userId = async (request, response, next) => {
  const { username } = request.body;
  const query = `SELECT user_id FROM user WHERE username LIKE '${username}'`;
  const result = await db.get(query);
  request.user = result.user_id;
  next();
};



//API-1
app.post("/register/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  let len = password.length;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (len < 6) {
    response.status(400);
    response.send("Password is too short");
  } else if (dbUser === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.status(200);
    console.log(hashedPassword);
    response.send("User created successfully");
  } else {
    console.log(dbUser);
    response.status(400);
    response.send("User already exists");
  }
});

//API-2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "TWITTERCLONE");
      response.send({ jwtToken });
      console.log(jwtToken);
      request.headers["authorization"] = jwtToken;
    }
  }
});

//API-3

app.get(
  "/user/tweets/feed/",
  authentication,
  userId,
  async (request, response) => {
    const { user } = request;
    const query = `SELECT username,tweet,date_time as dateTime
        FROM follower INNER JOIN user ON user.user_id = follower.following_user_id
     INNER JOIN tweet ON tweet.user_id=user.user_id
     WHERE follower.follower_user_id = ${user}
      ORDER BY dateTime DESC
     LIMIT 4 OFFSET 0
     ;`;
    const result = await db.all(query);
    response.send(result);
  }
);

//API-4

app.get(
  "/user/following/",
  authentication,
  userId,
  async (request, response) => {
    const { user } = request;
    const query = `SELECT name FROM user INNER JOIN follower 
    ON user.user_id=follower.following_user_id 
    WHERE follower.follower_user_id = ${user} ;`;
    const result = await db.all(query);
    response.send(result);
  }
);

//API-5

app.get(
  "/user/followers/",
  authentication,
  userId,
  async (request, response) => {
    const { user } = request;
    const query = `SELECT name FROM user INNER JOIN follower 
    ON user.user_id=follower.follower_user_id 
    WHERE follower.following_user_id = ${user};`;
    const result = await db.all(query);
    response.send(result);
  }
);

//API-6

app.get(
  "/tweets/:tweetId/",
  authentication,
  userId,
  async (request, response) => {
    const { user } = request;
    const { tweetId } = request.params;
    const query = `SELECT tweet,COUNT(like_id) AS likes,COUNT(reply_id) AS replies,tweet.date_time AS dateTime
                    FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
                    INNER JOIN like ON tweet.tweet_id = like.tweet_id
                    WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id IN  (SELECT following_user_id FROM follower
                        WHERE follower_user_id = ${user});`;
    const result = await db.get(query);
    if (result.tweet !== null) {
      response.send(result);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API-7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  userId,
  async (request, response) => {
    const { user } = request;
    const { tweetId } = request.params;
    const query = `SELECT username FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
  INNER JOIN user ON user.user_id = tweet.user_id 
  WHERE tweet.tweet_id = ${tweetId} AND like.user_id IN  (SELECT following_user_id 
    FROM follower WHERE follower_user_id = ${user});`;
    const result = await db.all(query);
    console.log(result);
    if (result.length !== 0) {
      response.send({
        likes: result,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API -8

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  userId,
  async (request, response) => {
    const { user } = request;
    const { tweetId } = request.params;
    const query = `SELECT name,reply FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
  INNER JOIN user ON user.user_id = reply.user_id 
  WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id IN  (SELECT following_user_id 
    FROM follower WHERE following_user_id = ${user});`;
    const result = await db.all(query);
    if (result.length !== 0) {
      response.send({ replies: result });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API - 9

app.get("/user/tweets/", authentication, async (request, response) => {
  const { user } = request;
  const query = `SELECT tweet,COUNT(like_id) AS likes,COUNT(reply_id) AS replies,tweet.date_time AS dateTime
                    FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
                    INNER JOIN like ON tweet.tweet_id = like.tweet_id
                    ;`;
  const result = await db.get(query);
  if (result !== undefined) {
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API-10

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const query = `UPDATE tweet SET tweet='${tweet}'`;
  const result = await db.run(query);
  response.send("Created a Tweet");
});

//API-11

app.delete(
  "/tweets/:tweetId/",
  authentication,
  userId,

  async (request, response) => {
    const { tweetId } = request.params;
    const { user, size } = request;
    const countQuery = `SELECT COUNT(*) AS total  FROM tweet;`;
    const cc2 = await db.get(countQuery);
    console.log(cc2);
    const result = `DELETE FROM tweet 
                WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id = ${user};`;
    await db.run(result);
    const count = `SELECT COUNT(*) as size2 FROM tweet;`;
    const cc1 = await db.get(count);
    console.log(cc1.size2);
    console.log(a);
    if (cc1.size2 === cc2.total) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
