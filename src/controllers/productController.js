const Product = require("../models/Product");
const Category = require("../models/Category");
const AppError = require("../utils/AppError");
const ApiResponse = require("../utils/apiResponse");
const catchAsync = require("../utils/catchAsync");
const {
  uploadImageBuffer,
  deleteImage,
} = require("../services/cloudinaryService");

const mongoose = require("mongoose");

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

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.getProducts = catchAsync(async (req, res, next) => {
  const { search, category } = req.query;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const filter = { isActive: true };

  if (search && search.trim()) {
    filter.name = {
      $regex: escapeRegex(search.trim()),
      $options: "i",
    };
  }

  if (category && category.trim()) {
    if (!mongoose.isValidObjectId(category.trim())) {
      return next(new AppError("Invalid category ID", 400));
    }

    filter.category = category.trim();
  }

 console.log("Product query diagnostics:", {
  database: Product.db.name,
  collection: Product.collection.name,
  categorySchemaType: Product.schema.path("category")?.instance,
  filter,
});

const diagnosticQuery = Product.find(filter).limit(1);
const diagnosticProducts = await diagnosticQuery.exec();

console.log(
  "Filter after Mongoose casting:",
  diagnosticQuery.getFilter()
);

console.log(
  "First matching product:",
  diagnosticProducts[0] || "NO MATCH"
);

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: "Products retrieved successfully",
    data: {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
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

  // Validate the category ID sent by the frontend dropdown.
  if (
    typeof category !== "string" ||
    !mongoose.isObjectIdOrHexString(category)
  ) {
    return next(
      new AppError("Please select a valid category", 400)
    );
  }

  // Find the existing category by ID, not by name.
  const categoryExists = await Category.findById(category);

  if (!categoryExists) {
    return next(
      new AppError("The selected category does not exist", 404)
    );
  }

  if (typeof sku !== "string" || !sku.trim()) {
    return next(new AppError("SKU is required", 400));
  }

  const normalizedSku = sku.trim().toUpperCase();

  const existingSku = await Product.findOne({
    sku: normalizedSku,
  });

  if (existingSku) {
    return next(
      new AppError("A product with this SKU already exists", 409)
    );
  }

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
    sku: normalizedSku,
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

exports.getProductsByCategory = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.isObjectIdOrHexString(categoryId)) {
    return next(new AppError("Invalid category ID", 400));
  }

  const filter = { isActive: true, category: categoryId };

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
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