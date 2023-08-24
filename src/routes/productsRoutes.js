import ProductsManager from '../dao/managers/fileSystem/productsManager.js';
import ProductsMongo from '../dao/managers/mongo/productsManagerMongo.js';
import { Router } from 'express';
import { io } from '../servers.js';

const router = Router();
const mongoManager = new ProductsMongo();
const fileManager = new ProductsManager('products.json');
router.get('/', async (req, res) => {
    try {
        let { limit = 10, page = 1, sort, query } = req.query;
        limit = Number(limit);
        page = Number(page);
        const skip = (page - 1) * limit;

        if (query) {
            try {
                query = JSON.parse(decodeURIComponent(query));
            } catch (error) {
                console.log('Error parsing query parameter: ', error);
            }
        }

        const products = await mongoManager.getProducts({
            limit,
            page,
            sort,
            query,
        });

        const totalProducts = await mongoManager.getTotalProducts();
        const totalPages = Math.ceil(totalProducts / limit);
        const hasPrevPage = page > 1;
        const hasNextPage = page < totalPages;
        const prevPage = hasPrevPage ? page - 1 : null;
        const nextPage = hasNextPage ? page + 1 : null;

        res.json({
            status: 'success',
            payload: products,
            totalPages: totalPages,
            prevPage: prevPage,
            nextPage: nextPage,
            page: page,
            hasPrevPage: hasPrevPage,
            hasNextPage: hasNextPage,
            prevLink: hasPrevPage ? `/products?page=${prevPage}` : null,
            nextLink: hasNextPage ? `/products?page=${nextPage}` : null,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:pid', async (req, res) => {
    try {
        const { pid } = req.params;
        const product = await fileManager.getProductsById(pid);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
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
router.put('/:pid', async (req, res) => {
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
router.delete('/:pid', async (req, res) => {
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
