const axios = require('axios');
const chalk = require('chalk');
const { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoRefreshToken } = require('amazon-cognito-identity-js');

// P1Doks Cognito Configuration
const COGNITO_CONFIG = {
  UserPoolId: 'ca-central-1_VGoFypwpe',
  ClientId: '6mu7svlaa4q8i1mvkeknhsruo8',
  Region: 'ca-central-1'
};

class CognitoAuth {
  constructor(username, password = null, refreshToken = null) {
    this.username = username;
    this.password = password;
    this.refreshToken = refreshToken;
    this.userPool = null;
    this.tokens = null;
    this.userId = null;

    this.client = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Initialize user pool
    this.userPool = new CognitoUserPool({
      UserPoolId: COGNITO_CONFIG.UserPoolId,
      ClientId: COGNITO_CONFIG.ClientId
    });
  }

  async authenticate() {
    try {
      let tokens;

      // Try refresh token first if available
      if (this.refreshToken && !this.password) {
        try {
          tokens = await this._refreshTokens();
        } catch (refreshError) {
          // Refresh failed, will need to re-authenticate with password
          throw new Error('REFRESH_TOKEN_EXPIRED');
        }
      } else {
        // Authenticate with username/password
        tokens = await this._performCognitoAuth();
      }

      this.tokens = tokens;

      // Extract user ID from ID token
      this.userId = this._extractUserIdFromToken(tokens.idToken);

      // Update axios client with access token
      this.client.defaults.headers['Authorization'] = `Bearer ${tokens.idToken}`;

      return tokens;
    } catch (error) {
      throw error;
    }
  }

  _performCognitoAuth() {
    return new Promise((resolve, reject) => {
      // Create cognito user
      const cognitoUser = new CognitoUser({
        Pool: this.userPool,
        Username: this.username
      });

      // Create authentication details
      const authenticationDetails = new AuthenticationDetails({
        Username: this.username,
        Password: this.password
      });

      // Authenticate
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const tokens = {
            accessToken: result.getAccessToken().getJwtToken(),
            idToken: result.getIdToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken()
          };
          resolve(tokens);
        },
        onFailure: (err) => {
          reject(err);
        }
      });
    });
  }

  _refreshTokens() {
    return new Promise((resolve, reject) => {
      // Create cognito user
      const cognitoUser = new CognitoUser({
        Pool: this.userPool,
        Username: this.username
      });

      // Create refresh token object
      const refreshTokenObj = new CognitoRefreshToken({
        RefreshToken: this.refreshToken
      });

      // Refresh the session
      cognitoUser.refreshSession(refreshTokenObj, (err, session) => {
        if (err) {
          reject(err);
          return;
        }

        const tokens = {
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken()
        };
        resolve(tokens);
      });
    });
  }

  _extractUserIdFromToken(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length === 3) {
        // Decode the payload (second part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        // userId might be in 'sub', 'user_id', 'userId', or custom claim
        return payload.sub || payload.user_id || payload.userId || payload['cognito:username'];
      }
    } catch (e) {
      console.error(chalk.yellow('Could not decode token to extract userId'));
    }

    return null;
  }

  getUserId() {
    return this.userId;
  }

  getTokens() {
    return this.tokens;
  }

  async makeAuthenticatedRequest(url, options = {}) {
    // Ensure we're authenticated
    if (!this.tokens) {
      await this.authenticate();
    }

    try {
      return await this.client(url, options);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Token expired - try to refresh
        if (this.refreshToken) {
          try {
            console.log(chalk.yellow('\n⚠ Token expired, refreshing...'));
            const tokens = await this._refreshTokens();
            this.tokens = tokens;
            this.client.defaults.headers['Authorization'] = `Bearer ${tokens.idToken}`;
            console.log(chalk.green('✓ Token refreshed, retrying request...\n'));

            // Retry the request with new token
            return await this.client(url, options);
          } catch (refreshError) {
            // Refresh failed - token is truly expired
            const tokenError = new Error('TOKEN_EXPIRED');
            tokenError.originalError = error;
            throw tokenError;
          }
        }

        // No refresh token available - throw error
        const tokenError = new Error('TOKEN_EXPIRED');
        tokenError.originalError = error;
        throw tokenError;
      }
      throw error;
    }
  }
}

module.exports = { CognitoAuth, COGNITO_CONFIG };
