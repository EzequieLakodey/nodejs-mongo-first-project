import { Router } from 'express';
import { usersService } from '../dao/index.js';
import bcrypt from 'bcrypt';
import passport from 'passport';
import { verifyToken } from '../middlewares/auth.js';
import { UserDTO } from '../dto/users.dto.js';
import { logger } from '../middlewares/logger.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/login', (req, res) => {
    logger.info('GET /api/sessions/login - rendering login page');
    res.render('login');
});

router.get('/signup', (req, res) => {
    logger.info('GET /api/sessions/signup - rendering signup page');
    res.render('signup');
});

router.post('/signup', async (req, res) => {
    try {
        logger.info('POST /api/sessions/signup - user attempting to sign up');
        const signupForm = req.body;
        // Check if the user already exists
        const user = await usersService.getByEmail(signupForm.email);
        if (user) {
            logger.warn('POST /api/sessions/signup - user already registered');
            return res.status(400).render('signup', {
                error: 'El usuario ya está registrado',
            });
        }
        // Hash the password
        signupForm.password = await bcrypt.hash(signupForm.password, 10);
        // Set the role based on the email
        signupForm.role =
            signupForm.email === 'admin@coder.com' ? 'admin' : 'user';

        // Save the user to the database
        const savedUser = await usersService.save(signupForm);

        logger.info('POST /api/sessions/signup - user registered successfully');
        res.render('login', { message: 'User registered' });
    } catch (error) {
        logger.error(`POST /api/sessions/signup - ${error.message}`);
        res.status(500).render('signup', { error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        logger.info('POST /api/sessions/login - user attempting to log in');
        const loginForm = req.body;
        const user = await usersService.getByEmail(loginForm.email);
        if (!user) {
            logger.warn('POST /api/sessions/login - invalid email or password');
            return res
                .status(401)
                .render('login', { error: 'Invalid email or password' });
        }

        if (
            !loginForm.password ||
            !user.password ||
            !bcrypt.compareSync(loginForm.password, user.password)
        ) {
            logger.warn('POST /api/sessions/login - invalid email or password');
            return res
                .status(401)
                .render('login', { error: 'Invalid email or password' });
        }
        // Generate a JWT
        const token = jwt.sign(
            {
                _id: user._id,
                first_name: user.first_name,
                email: user.email,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Set the JWT in a cookie
        res.cookie('token', token, { httpOnly: true });

        logger.info('POST /api/sessions/login - user logged in successfully');
        res.redirect('/api/products');
    } catch (error) {
        logger.error(`POST /api/sessions/login - ${error.message}`);
        res.status(500).send({ error: error.toString() });
    }
});

router.get('/current', verifyToken, (req, res) => {
    logger.info('GET /api/sessions/current - fetching current user');
    // The verified user is available as req.user
    const userDto = new UserDTO(req.user);
    res.json(userDto);
});

router.get('/profile', verifyToken, (req, res) => {
    logger.info('GET /api/sessions/profile - rendering profile page');
    // The verified user is available as req.user
    const { first_name, email } = req.user;
    // Render the view with the user data
    res.render('profile', { first_name, email });
});

// GitHub authentication route
router.get(
    '/github',
    passport.authenticate('githubLoginStrategy', { session: false })
);

// GitHub authentication callback route
router.get(
    '/github-callback',
    passport.authenticate('githubLoginStrategy', {
        failureRedirect: '/login',
        session: false,
    }),
    (req, res) => {
        // Generate a JWT token for the user
        const token = jwt.sign(
            {
                _id: req.user._id,
                first_name: req.user.first_name,
                email: req.user.email,
                role: req.user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Set the JWT token in a cookie

        res.cookie('token', token, { httpOnly: true });

        // Redirect to '/api/products' after GitHub login
        res.redirect('/api/products');
    }
);

// Add the /current route to get the current user based on the token
router.get(
    '/current',
    passport.authenticate('current', { session: false }),
    (req, res) => {
        const { first_name, email } = req.user;
        res.json({ first_name, email });
    }
);

router.post('/logout', (req, res) => {
    logger.info('POST /api/sessions/logout - user logged out');
    // Clear the JWT cookie
    res.clearCookie('token');

    // Redirect to the login page
    res.redirect('/api/sessions/login');
});

export { router as sessionsRouter };
