const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
let length = null;
const path = require("path");
const jwt = require("jsonwebtoken");

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

app.get("/follower/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const query = `SELECT username FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
  INNER JOIN user ON user.user_id = like.user_id 
  WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id IN  (SELECT following_user_id FROM follower);`;
  const result = await db.all(query);
  response.send({
    likes: result,
  });
});

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

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const query = `SELECT username,tweet,date_time as dateTime
   FROM follower INNER JOIN user ON user.user_id = follower.following_user_id
     INNER JOIN tweet ON tweet.user_id=user.user_id
      ORDER BY dateTime DESC
     LIMIT 4 OFFSET 0
     ;`;
  const result = await db.all(query);
  response.send(result);
});

//API-4

app.get("/user/following/", authentication, async (request, response) => {
  const query = `SELECT name FROM user INNER JOIN follower 
    ON user.user_id=follower.following_user_id  ;`;
  const result = await db.all(query);
  response.send(result);
});

//API-5

app.get("/user/followers/", authentication, async (request, response) => {
  const query = `SELECT name FROM user INNER JOIN follower 
    ON user.user_id=follower.follower_user_id;`;
  const result = await db.all(query);
  response.send(result);
});

//API-6

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const query = `SELECT tweet,COUNT(like_id) AS likes,COUNT(reply_id) AS replies,tweet.date_time AS dateTime
                    FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
                    INNER JOIN like ON tweet.tweet_id = like.tweet_id
                    WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id IN  (SELECT following_user_id FROM follower);`;
  const result = await db.all(query);
  if (result !== undefined) {
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API-7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT username FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
  INNER JOIN user ON user.user_id = like.user_id 
  WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id IN  (SELECT following_user_id FROM follower);`;
    const result = await db.all(query);
    if (result !== undefined) {
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
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT username FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
  INNER JOIN user ON user.user_id = reply.user_id 
  WHERE tweet.tweet_id = ${tweetId} AND tweet.user_id IN  (SELECT following_user_id FROM follower);`;
    const result = await db.all(query);
    if (result !== undefined) {
      response.send({ replies: result });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API - 9

app.get("/user/tweets/", authentication, async (request, response) => {
  const query = `SELECT tweet,COUNT(like_id) AS likes,COUNT(reply_id) AS replies,tweet.date_time AS dateTime
                    FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id 
                    INNER JOIN like ON tweet.tweet_id = like.tweet_id
                    ;`;
  const result = await db.all(query);
  if (result !== undefined) {
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API-10

app.post("/user/tweets/", async (request, response) => {
  const { tweet } = request.body;
  const query = `UPDATE tweet SET tweet='${tweet}`;
  const result = await db.run(query);
  response.send("Created a Tweet");
});

//API-11

app.put("/change-password", async (request, response) => {
  const { username, oldPassword, newPassword } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (newPassword.length < 5) {
    response.status(400);
    response.send("Password too short");
  } else if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      oldPassword,
      dbUser.password
    );

    if (isPasswordMatched === true) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updateQuery = `
          UPDATE user
          SET password = '${hashedPassword}';`;
      await db.run(updateQuery);
      response.status(200);
      response.send("Password updated");
    } else {
      response.status(400);
      response.send("Invalid Current Password");
    }
  }
});

module.exports = app;
