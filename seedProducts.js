require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('./Models/productSchema');

// Sample product data
const sampleProducts = [
  {
    title: "Premium Dog Food - Chicken & Rice",
    description: "High-quality dog food made with real chicken and rice. Perfect for adult dogs of all sizes. Rich in protein and essential nutrients.",
    price: 1299,
    weight: "3kg",
    image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=500&h=500&fit=crop",
    category: "Dog"
  },
  {
    title: "Puppy Food - Salmon & Sweet Potato",
    description: "Specially formulated for growing puppies. Contains DHA for brain development and high-quality protein for healthy growth.",
    price: 1599,
    weight: "2kg",
    image: "https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=500&h=500&fit=crop",
    category: "Dog"
  },
  {
    title: "Senior Dog Food - Turkey & Vegetables",
    description: "Gentle nutrition for senior dogs. Easy to digest with joint support ingredients. Lower calories for less active older dogs.",
    price: 1399,
    weight: "2.5kg",
    image: "https://images.unsplash.com/photo-1551717743-49959800b1f6?w=500&h=500&fit=crop",
    category: "Dog"
  },
  {
    title: "Kitten Food - Chicken & Milk",
    description: "Complete nutrition for growing kittens. With DHA from fish oil to support brain and eye development.",
    price: 1199,
    weight: "1kg",
    image: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=500&h=500&fit=crop",
    category: "Cat"
  },
  {
    title: "Indoor Cat Food - Chicken & Rice",
    description: "Specially formulated for indoor cats. Helps maintain healthy weight and reduces hairball formation.",
    price: 1099,
    weight: "1.5kg",
    image: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=500&h=500&fit=crop",
    category: "Cat"
  },
  {
    title: "Grain-Free Dog Food - Lamb & Vegetables",
    description: "Natural grain-free dog food with lamb as the first ingredient. Perfect for dogs with sensitive stomachs.",
    price: 1699,
    weight: "5kg",
    image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500&h=500&fit=crop",
    category: "Dog"
  },
  {
    title: "Wet Cat Food Variety Pack",
    description: "12 cans of delicious wet cat food in 4 different flavors. Made with real meat and no artificial preservatives.",
    price: 899,
    weight: "0.5kg",
    image: "https://images.unsplash.com/photo-1571988840298-3b5301d5109b?w=500&h=500&fit=crop",
    category: "Cat"
  }
];

async function addSampleProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Check if products already exist
    const existingProducts = await Product.countDocuments();
    
    if (existingProducts > 0) {
      console.log(`Database already has ${existingProducts} products. Skipping sample data insertion.`);
      process.exit(0);
    }
    
    // Insert sample products
    const result = await Product.insertMany(sampleProducts);
    console.log(`Successfully inserted ${result.length} sample products:`);
    
    result.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title} - ₹${product.price} (${product.category})`);
    });
    
    console.log('\nSample products added successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error adding sample products:', error);
    process.exit(1);
  }
}

addSampleProducts();
