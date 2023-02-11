const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const dbObjectToResponseObject = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,

    followerId: dbObject.follower_id,
    followerUserId: dbObject.follower_user_id,
    followingUserId: dbObject.follower_user_id,

    tweetId: dbObject.tweet_id,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,

    replyId: dbObject.reply_id,
    reply: dbObject.reply,

    likeId: dbObject.like_id,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "HARRY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10); //Encrypting password
  const getUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    const postDetailsQuery = `
        INSERT INTO user (username, password, name, gender)
        VALUES ('${username}',
                '${hashedPassword}',
                '${name}',
                '${gender}'
                )`;
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const dbResponse = await db.run(postDetailsQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "HARRY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getUserTweetsQuery = `
    SELECT username, tweet, date_time
    FROM user NATURAL JOIN tweet
    INNER JOIN follower 
    ON tweet.user_id = follower.following_user_id
    WHERE follower.follower_user_id ='${4}'
    ORDER BY date_time DESC
    LIMIT 4;`;
  const result = await db.all(getUserTweetsQuery);
  response.send(result.map((each) => dbObjectToResponseObject(each)));
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { followerUserId } = request.body;
  const getFollowingQuery = `
    SELECT name 
    FROM 
        user 
    INNER JOIN follower
    ON user_id = follower.follower_id
    WHERE follower.follower_user_id = '${1}';`;
  const results = await db.all(getFollowingQuery);
  response.send(results.map((each) => dbObjectToResponseObject(each)));
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { followingUserId } = request.body;
  const getFollowingQuery = `
    SELECT name FROM 
    user INNER JOIN follower
    ON user.user_id = follower.follower_id
    WHERE follower.following_user_id = '${2}';`;
  const results = await db.all(getFollowingQuery);
  response.send(results.map((each) => dbObjectToResponseObject(each)));
});

// API 6
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { username } = request;
  const { followerUserId } = request.body;
  getUserQuery = `
    SELECT * FROM user
    WHERE user_id = "${1}";`;
  const dbResponse = await db.get(getUserQuery);
  if (dbResponse === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    getTweetOfUserQuery = `
        SELECT tweet.tweet AS tweet,
            SUM(like.like_id) AS likes,
            SUM(reply.reply_id)AS replies,
            tweet.date_time AS dateTime
        FROM
            tweet NATURAL JOIN like
        NATURAL JOIN reply
        INNER JOIN follower ON reply.user_id = follower.follower_user_id
        WHERE follower_user_id = '${1}';`;
    const result = await db.get(getTweetOfUserQuery);
    response.send(result);
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    getUserQuery = `
    SELECT * FROM user
    WHERE username = "${username}";`;
    const dbResponse = await db.get(getUserQuery);
    if (dbResponse === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      getTweetOfUserQuery = `
        SELECT name AS likes
        FROM user NATURAL JOIN like
        NATURAL JOIN tweet
        INNER JOIN follower ON tweet.user_id = follower.follower_id
        WHERE following_user_id = '${1}';`;
      const dbResponse = await db.get(getTweetOfUserQuery);
      response.send(dbResponse);
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    getUserQuery = `
    SELECT * FROM user
    WHERE username = "${username}";`;
    const dbResponse = await db.get(getUserQuery);
    if (dbResponse === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      getTweetOfUserQuery = `
        SELECT name AS name,
        reply AS reply
        FROM tweet NATURAL JOIN user
        NATURAL JOIN reply
        INNER JOIN follower ON reply.user_id = follower.follower_user_id
        WHERE user_id = '${1}';`;
      const dbResponse = await db.all(getTweetOfUserQuery);
      response.send(dbResponse.map((each) => dbObjectToResponseObject(each)));
    }
  }
);

//API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getTweetQuery = `
    SELECT tweet, 
            SUM(like.like_id) AS likes,
            SUM(reply.reply_id) AS replies,
            date_time
     FROM tweet NATURAL JOIN like
        NATURAL JOIN reply
        INNER JOIN follower ON reply.user_id = follower.follower_id
        WHERE user_id = '${1}';`;
  const dbResponse = await db.all(getTweetQuery);
  response.send(dbResponse);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const postTweetQuery = `
    INSERT INTO tweet (tweet)
    VALUES ('${tweet}');`;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.body;
    const { username } = request;
    getUserQuery = `
        SELECT * FROM user
        WHERE username = "${username}";`;
    const dbResponse = await db.get(getUserQuery);
    if (dbResponse === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `
            DELETE FROM tweet
            WHERE tweet_id = '${1}';`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
