import passport from 'passport';
import LocalStrategy from 'passport-local';
import { usersMongo } from '../dao/controllers/mongo/users.mongo.js';
import githubStrategy from 'passport-github2';
import { config } from './config.js';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';

export const initializePassport = () => {
    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (user, done) {
        done(null, user);
    });
    passport.use(
        'signupStrategy',
        new LocalStrategy(
            {
                //username, password
                usernameField: 'email',
                passReqToCallback: true,
            },
            async (req, username, password, done) => {
                try {
                    const { first_name } = req.body;
                    //verificar si el usuario ya se registro
                    const user = await usersMongo.getByEmail(username);
                    if (user) {
                        return done(null, false);
                    }
                    const newUser = {
                        first_name: first_name,
                        email: username,
                        password: createHash(password),
                    };
                    const userCreated = await usersMongo.save(newUser);
                    return done(null, userCreated); //En este punto passport completa el proceso de manera satisfactoria
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    passport.use(
        'loginStrategy',
        new LocalStrategy(
            {
                usernameField: 'email',
            },
            async (username, password, done) => {
                try {
                    //verificar si el usuario ya se registro
                    const user = await usersMongo.getByEmail(username);
                    if (!user) {
                        return done(null, false);
                    }
                    //si el usuario existe, validar la contraseña
                    if (isValidPassword(user, password)) {
                        return done(null, user);
                    } else {
                        return done(null, false);
                    }
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    passport.use(
        'githubLoginStrategy',
        new githubStrategy(
            {
                clientID: config.github.clientId,
                clientSecret: config.github.clientSecret,
                callbackURL: config.github.callbackUrl,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    let email = `${profile.username}@github.com`;
                    let user = await usersMongo.getByEmail(email);
                    if (!user) {
                        const newUser = {
                            email: email,
                            first_name: profile.username,
                            password: process.env.DEFAULT_PWD || 'githubuser', //default password for github users
                        };
                        const userCreated = await usersMongo.save(newUser);
                        return done(null, userCreated);
                    } else {
                        return done(null, user);
                    }
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    const options = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET,
    };

    passport.use(
        'jwt',
        new JwtStrategy(options, (jwt_payload, done) => {
            if (jwt_payload) {
                return done(null, jwt_payload);
            } else {
                return done(null, false);
            }
        })
    );

    const cookieExtractor = function (req) {
        let token = null;
        if (req && req.cookies) {
            token = req.cookies['token'];
        }
        return token;
    };

    const opts = {
        jwtFromRequest: cookieExtractor,
        secretOrKey: process.env.JWT_SECRET,
    };

    passport.use(
        'current',
        new JwtStrategy(opts, function (jwt_payload, done) {
            usersMongo
                .getById(jwt_payload.id)
                .then((user) => {
                    if (user) {
                        return done(null, user);
                    } else {
                        return done(null, false);
                    }
                })
                .catch((err) => done(err, false));
        })
    );
};
