const express = require("express");
const server_instance = express();
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
server_instance.use(express.json());
const dataBasePath = path.join(__dirname, "covid19IndiaPortal.db");
let database_path = null;

const initializeDataBaseAndServer = async () => {
  try {
    database_path = await open({
      filename: dataBasePath,
      driver: sqlite3.Database,
    });
    server_instance.listen(6000, () => {
      console.log("server is running on port of 6000");
    });
  } catch (error) {
    console.log(`Database Error ${error.message}`);
    process.exit(-1);
  }
};
initializeDataBaseAndServer();

const stateSnakeCaseIntoCamelCase = (stateArray) => {
  return {
    stateId: stateArray.state_id,
    stateName: stateArray.state_name,
    population: stateArray.population,
  };
};

const DistrictSnakeCaseIntoCamelCase = (DistrictArray) => {
  return {
    districtId: DistrictArray.district_id,
    districtName: DistrictArray.district_name,
    stateId: DistrictArray.state_id,
    cases: DistrictArray.cases,
    cured: DistrictArray.curved,
    active: DistrictArray.active,
    deaths: DistrictArray.deaths,
  };
};

//  Middleware Function to Authentication with Token
const TokenAuthentication = (request, response, next) => {
  const authenticationHeaders = request.headers["authorization"];
  let jwtToken;
  if (authenticationHeaders !== undefined) {
    jwtToken = authenticationHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API-2 GET (Returns a list of all states in the state table)
server_instance.get(
  "/states/",
  TokenAuthentication,
  async (request, response) => {
    const getAllStateSQLQuery = `SELECT * FROM state`;
    const getAllState = await database_path.all(getAllStateSQLQuery);

    response.send(
      getAllState.map((stateArray) => stateSnakeCaseIntoCamelCase(stateArray))
    );
  }
);

// API-3 GET (Returns a state based on the state ID)
server_instance.get(
  "/states/:stateId/",
  TokenAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateSQLQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
    const getStateArray = await database_path.get(getStateSQLQuery);
    response.send(stateSnakeCaseIntoCamelCase(getStateArray));
  }
);

// API-4 POST (Create a district in the district table, district_id is auto-incremented)
server_instance.post(
  "/districts/",
  TokenAuthentication,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const createDistrictsData = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES
    ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
    await database_path.run(createDistrictsData);
    response.send("District Successfully Added");
  }
);

// API-5 GET (Returns a state based on the state ID)
server_instance.get(
  "/districts/:districtId/",
  TokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictSQLQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const DistrictArray = await database_path.get(getDistrictSQLQuery);
    response.send(DistrictSnakeCaseIntoCamelCase(DistrictArray));
  }
);

// API-6 DELETE (Deletes a district from the district table based on the district ID)
server_instance.delete(
  "/districts/:districtId/",
  TokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictData = `DELETE FROM district WHERE district_id = '${districtId}';`;
    await database_path.run(deleteDistrictData);
    response.send("District Removed");
  }
);

// API 7 PUT (Updates the details of a specific district based on the district ID)
server_instance.put(
  "/districts/:districtId/",
  TokenAuthentication,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictSQLQuery = `UPDATE district SET 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
    WHERE district_id = '${districtId}';`;
    await database_path.run(updateDistrictSQLQuery);
    response.send("District Details Updated");
  }
);

// API-8 GET (Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID)
server_instance.get(
  "/states/:stateId/stats/",
  TokenAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const statisticsSQLQuery = `SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM 
    district
    WHERE state_id = '${stateId}';`;
    const statistics = await database_path.get(statisticsSQLQuery);
    response.send(statistics);
  }
);

// API-1 POST  login
server_instance.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkLoginUsernameQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const checkLoginUser = await database_path.get(checkLoginUsernameQuery);

  if (checkLoginUser === undefined) {
    response.status(400).send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(
      password,
      checkLoginUser.password
    );
    if (checkPassword === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

module.exports = server_instance;
