const Product = require("../models/Product");
const Category = require("../models/Category");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const {
  uploadImageBuffer,
  deleteImage,
} = require("../services/cloudinaryService");

exports.getProducts = catchAsync(async (req, res) => {
  const { search, category, page = 1, limit = 10 } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  return ApiResponse.success(res, {
    message: "Products fetched successfully",
    data: products,
    meta: {
      currentPage: pageNum,
      pageSize: limitNum,
      totalRecords: total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

exports.getProductById = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate(
    "category",
    "name slug",
  );
  if (!product || !product.isActive)
    return next(new AppError("Product not found", 404));
  return ApiResponse.success(res, {
    message: "Product fetched successfully",
    data: product,
  });
});

exports.createProduct = catchAsync(async (req, res, next) => {
  const { name, description, sku, price, stock, category } = req.body;

  let categoryExists = await Category.findOne({
    name: new RegExp(`^${category}$`, "i"),
  });

  if (!categoryExists) {
    categoryExists = await Category.create({
      name: category,
      slug: category.toLowerCase().replace(/\s+/g, "-"),
    });
  }

  const existingSku = await Product.findOne({ sku: sku.toUpperCase() });
  if (existingSku)
    return next(new AppError("A product with this SKU already exists", 409));

  let imageUrl = null;
  let imagePublicId = null;
  if (req.file) {
    const result = await uploadImageBuffer(req.file.buffer);
    imageUrl = result.secure_url;
    imagePublicId = result.public_id;
  }

  const product = await Product.create({
    name,
    description,
    sku,
    price,
    stock,
    category: categoryExists._id,
    imageUrl,
    imagePublicId,
  });

  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Product created successfully",
    data: product,
  });
});

exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  if (req.body.category) {
    let categoryExists = await Category.findOne({
      name: new RegExp(`^${req.body.category}$`, "i"),
    });

    if (!categoryExists) {
      categoryExists = await Category.create({
        name: req.body.category,
        slug: req.body.category.toLowerCase().replace(/\s+/g, "-"),
      });
    }

    req.body.category = categoryExists._id;
  }

  if (req.file) {
    if (product.imagePublicId) await deleteImage(product.imagePublicId);
    const result = await uploadImageBuffer(req.file.buffer);
    product.imageUrl = result.secure_url;
    product.imagePublicId = result.public_id;
  }

  Object.assign(product, req.body);
  await product.save();

  return ApiResponse.success(res, {
    message: "Product updated successfully",
    data: product,
  });
});

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  if (product.imagePublicId) await deleteImage(product.imagePublicId);
  await product.deleteOne();

  return ApiResponse.success(res, {
    message: "Product deleted successfully",
    data: null,
  });
});
