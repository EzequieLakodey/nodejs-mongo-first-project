import ProductsManager from '../dao/controllers/fs/productsManager.js';
import ProductsManagerMongo from '../dao/controllers/mongo/products.mongo.js';
import { Router } from 'express';
import { io } from '../servers.js';
import { verifyToken, requireRole } from '../middlewares/auth.js';
import { faker } from '@faker-js/faker';

const router = Router();
const mongoManager = new ProductsManagerMongo();
const fileManager = new ProductsManager('products.json');

router.get('/', verifyToken, async (req, res) => {
    let first_name, email;

    if (req.user) {
        first_name = req.user.first_name;
        email = req.user.email;
    }
    // Continue with your code. `first_name` and `email` will be undefined if the user is not registered.
    try {
        const page = parseInt(req.query.page) || 1;
        const size = parseInt(req.query.size) || 10;
        const products = await mongoManager.getProducts({
            page: page,
            limit: size,
        });
        const total = await mongoManager.getTotalProducts(); // use getTotalProducts instead of countProducts
        const pages = Math.ceil(total / size);
        const prevPage = page - 1 > 0 ? page - 1 : null;
        const nextPage = page + 1 <= pages ? page + 1 : null;
        res.render('products', {
            products,
            prevPage,
            nextPage,
            first_name,
            email,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('There was an error getting the products');
    }
});

router.get('/mockingproducts', (req, res) => {
    const products = Array.from({ length: 100 }, () => ({
        title: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        code: faker.datatype.uuid(),
        category: faker.commerce.department(),
        price: faker.commerce.price(),
        stock: faker.datatype.number(),
    }));

    res.json(products);
});

router.get('/:pid', async (req, res) => {
    try {
        const { pid } = req.params;
        const product = await mongoManager.getProductsById(pid);
        if (product) {
            res.render('productsDetails', { product: product.toObject() });
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const product = req.body;
        const newProductFile = await fileManager.addProduct(product);
        const newProductMongo = await mongoManager.addProduct(product);
        io.emit('new-product', newProductFile);
        res.json({
            fileSystemProduct: newProductFile,
            mongoDBProduct: newProductMongo,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:pid', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { pid } = req.params;
        const updatedProduct = await fileManager.updateProduct(pid, req.body);
        if (updatedProduct) {
            res.json(updatedProduct);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:pid', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const { pid } = req.params;
        const deletedProductId = await fileManager.deleteProduct(pid);
        if (deletedProductId) {
            io.emit('delete-product', deletedProductId);
            res.json({
                message: `Product ${deletedProductId} deleted successfully`,
            });
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export { router as productsRouter };
