const nodemailer = require('nodemailer');

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

const sendOrderConfirmationEmail = async (orderData) => {
  const { order, user, customerEmail } = orderData;
  
  try {
    // Format order items for email display
    const orderItemsHTML = order.products.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.product.name || 'Product'}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ₹${item.price}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ₹${item.price * item.quantity}
        </td>
      </tr>
    `).join('');

    // Calculate subtotal and delivery fee
    const subtotal = order.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = subtotal < 999 ? 99 : 0;
    const total = order.total_amount;

    // Customer email content
    const customerEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - MotluPets</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c5aa0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .order-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; }
          th { background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
          .total-row { font-weight: bold; background-color: #f0f8ff; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐕 MotluPets - Order Confirmation</h1>
            <p>Thank you for your order!</p>
          </div>
          
          <div class="content">
            <h2>Hi ${user.name || 'Valued Customer'},</h2>
            <p>Great news! We've received your order and it's being processed. Here are the details:</p>
            
            <div class="order-details">
              <h3>Order Information</h3>
              <p><strong>Order ID:</strong> ${order.orderNumber || order.order_id}</p>
              <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
              <p><strong>Payment Method:</strong> ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
              <p><strong>Payment Status:</strong> ${order.payment_status}</p>
              
              <h3>Order Items</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItemsHTML}
                  <tr>
                    <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold;">₹${subtotal}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding: 10px; text-align: right;">Delivery Fee:</td>
                    <td style="padding: 10px; text-align: right;">₹${deliveryFee}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="3" style="padding: 15px; text-align: right; font-size: 18px;">Total Amount:</td>
                    <td style="padding: 15px; text-align: right; font-size: 18px;">₹${total}</td>
                  </tr>
                </tbody>
              </table>
              
              ${order.shipping_address ? `
              <h3>Shipping Address</h3>
              <p>
                ${order.shipping_address.fullName}<br>
                ${order.shipping_address.streetAddress}<br>
                ${order.shipping_address.city}, ${order.shipping_address.state} - ${order.shipping_address.pincode}<br>
                ${order.shipping_address.country}<br>
                Phone: ${order.shipping_address.phoneNumber}
              </p>
              ` : ''}
              
              ${order.special_instructions ? `
              <h3>Special Instructions</h3>
              <p>${order.special_instructions}</p>
              ` : ''}
            </div>
            
            <p>We'll send you another email with tracking information once your order ships.</p>
            <p>If you have any questions about your order, please contact our support team.</p>
          </div>
          
          <div class="footer">
            <p>Thank you for choosing MotluPets! 🐾</p>
            <p>For support, contact us at: ${process.env.ADMIN_EMAIL}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Admin notification email content
    const adminEmailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Order Received - Motlupets Admin</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .order-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; }
          th { background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
          .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 New Order Alert - MotluPets</h1>
            <p>A new order has been placed!</p>
          </div>
          
          <div class="content">
            <div class="alert">
              <strong>Action Required:</strong> A new order needs your attention and processing.
            </div>
            
            <div class="order-details">
              <h3>Order Information</h3>
              <p><strong>Order ID:</strong> ${order.orderNumber || order.order_id}</p>
              <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}</p>
              <p><strong>Customer:</strong> ${user.name}</p>
              <p><strong>Customer Email:</strong> ${user.email}</p>
              <p><strong>Payment Method:</strong> ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
              <p><strong>Payment Status:</strong> ${order.payment_status}</p>
              ${order.payment_id ? `<p><strong>Payment ID:</strong> ${order.payment_id}</p>` : ''}
              
              <h3>Order Items</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItemsHTML}
                  <tr style="font-weight: bold; background-color: #f0f8ff;">
                    <td colspan="3" style="padding: 15px; text-align: right; font-size: 16px;">Total Amount:</td>
                    <td style="padding: 15px; text-align: right; font-size: 16px;">₹${total}</td>
                  </tr>
                </tbody>
              </table>
              
              ${order.shipping_address ? `
              <h3>Shipping Address</h3>
              <p>
                <strong>${order.shipping_address.fullName}</strong><br>
                ${order.shipping_address.streetAddress}<br>
                ${order.shipping_address.city}, ${order.shipping_address.state} - ${order.shipping_address.pincode}<br>
                ${order.shipping_address.country}<br>
                <strong>Phone:</strong> ${order.shipping_address.phoneNumber}<br>
                ${order.shipping_address.email ? `<strong>Email:</strong> ${order.shipping_address.email}` : ''}
              </p>
              ` : ''}
              
              ${order.special_instructions ? `
              <h3>Special Instructions</h3>
              <div style="background-color: #e7f3ff; padding: 10px; border-radius: 5px;">
                ${order.special_instructions}
              </div>
              ` : ''}
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Process the order in your admin panel</li>
              <li>Prepare items for shipping</li>
              <li>Update order status when shipped</li>
              <li>Send tracking information to customer</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to customer
    const customerMailOptions = {
      from: {
        name: 'MotluPets',
        address: process.env.EMAIL_USER
      },
      to: customerEmail || user.email,
      subject: `Order Confirmation - ${order.orderNumber || order.order_id} - MotluPets`,
      html: customerEmailHTML
    };

    // Send email to admin
    const adminMailOptions = {
      from: {
        name: 'MotluPets Order System',
        address: process.env.EMAIL_USER
      },
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 New Order Alert - ${order.orderNumber || order.order_id} - ₹${total}`,
      html: adminEmailHTML
    };

    // Send both emails
    const [customerResult, adminResult] = await Promise.allSettled([
      transporter.sendMail(customerMailOptions),
      transporter.sendMail(adminMailOptions)
    ]);

    console.log('📧 Email sending results:');
    
    if (customerResult.status === 'fulfilled') {
      console.log('✅ Customer email sent successfully:', customerResult.value.messageId);
    } else {
      console.error('❌ Customer email failed:', customerResult.reason);
    }

    if (adminResult.status === 'fulfilled') {
      console.log('✅ Admin email sent successfully:', adminResult.value.messageId);
    } else {
      console.error('❌ Admin email failed:', adminResult.reason);
    }

    return {
      customerEmailSent: customerResult.status === 'fulfilled',
      adminEmailSent: adminResult.status === 'fulfilled',
      customerMessageId: customerResult.status === 'fulfilled' ? customerResult.value.messageId : null,
      adminMessageId: adminResult.status === 'fulfilled' ? adminResult.value.messageId : null
    };

  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw error;
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email for registration verification
const sendVerificationOTP = async (email, name, otp) => {
  try {
    const mailOptions = {
      from: {
        name: 'MotluPets',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Verify Your Email - MotluPets Registration',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - MotluPets</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #fff; padding: 30px 20px; border: 1px solid #ddd; }
            .otp-box { background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 10px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 14px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
            .warning { color: #e74c3c; font-weight: bold; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🐾 Welcome to MotluPets!</h1>
              <p>Email Verification Required</p>
            </div>
            
            <div class="content">
              <h2>Hi ${name}!</h2>
              <p>Thank you for registering with MotluPets! To complete your registration and secure your account, please verify your email address using the verification code below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 16px; color: #666;">Your Verification Code:</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 0; font-size: 14px; color: #666;">Enter this code on the verification page</p>
              </div>
              
              <div class="warning">
                ⏰ This code will expire in 2 minutes for security reasons.
              </div>
              
              <p><strong>Important Security Notes:</strong></p>
              <ul>
                <li>Never share this code with anyone</li>
                <li>MotluPets staff will never ask for your verification code</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
              
              <p>Once verified, you'll be able to:</p>
              <ul>
                <li>🛒 Shop premium pet products</li>
                <li>❤️ Save favorites to your wishlist</li>
                <li>📦 Track your orders easily</li>
                <li>🎉 Get exclusive offers and updates</li>
              </ul>
            </div>
            
            <div class="footer">
              <p><strong>MotluPets</strong> - Your Pet's Happiness, Our Priority</p>
              <p>Need help? Contact us at support@motlupets.com</p>
              <p style="font-size: 12px; color: #999;">This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification OTP sent successfully:', result.messageId);
    return result;

  } catch (error) {
    console.error('❌ Failed to send verification OTP:', error);
    throw error;
  }
};

module.exports = {
  sendOrderConfirmationEmail,
  sendVerificationOTP,
  generateOTP,
  transporter
};
