const sgMail = require('@sendgrid/mail');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
        email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER
      },
      to: customerEmail || user.email,
      subject: `Order Confirmation - ${order.orderNumber || order.order_id} - MotluPets`,
      html: customerEmailHTML
    };

    // Send email to admin
    const adminMailOptions = {
      from: {
        name: 'MotluPets Order System',
        email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER
      },
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 New Order Alert - ${order.orderNumber || order.order_id} - ₹${total}`,
      html: adminEmailHTML
    };

    // Send both emails using SendGrid
    const [customerResult, adminResult] = await Promise.allSettled([
      sgMail.send(customerMailOptions),
      sgMail.send(adminMailOptions)
    ]);

    console.log('📧 Email sending results:');
    
    if (customerResult.status === 'fulfilled') {
      console.log('✅ Customer email sent successfully via SendGrid');
    } else {
      console.error('❌ Customer email failed:', customerResult.reason);
    }

    if (adminResult.status === 'fulfilled') {
      console.log('✅ Admin email sent successfully via SendGrid');
    } else {
      console.error('❌ Admin email failed:', adminResult.reason);
    }

    return {
      customerEmailSent: customerResult.status === 'fulfilled',
      adminEmailSent: adminResult.status === 'fulfilled',
      customerMessageId: customerResult.status === 'fulfilled' ? 'sendgrid-success' : null,
      adminMessageId: adminResult.status === 'fulfilled' ? 'sendgrid-success' : null
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
        email: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER
      },
      to: email,
      subject: `Your MotluPets verification code: ${otp}`,
      // Add deliverability headers
      headers: {
        'X-Entity-Ref-ID': `motlupets-otp-${Date.now()}`,
        'X-Priority': '3',
        'Importance': 'Normal'
      },
      // Add categories for SendGrid tracking
      categories: ['otp', 'user-verification', 'transactional'],
      // Add plain text version
      text: `
Hi ${name},

Welcome to MotluPets!

Your email verification code is: ${otp}

Please enter this code on the verification page to complete your registration.

This code will expire in 10 minutes for security reasons.

If you didn't create an account with MotluPets, please ignore this email.

Best regards,
The MotluPets Team

Need help? Contact us at support@motlupets.com
      `,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - MotluPets</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 20px 0; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #4a90e2; color: white; padding: 30px 40px; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px;">Welcome to MotluPets</h1>
                      <p style="margin: 10px 0 0 0; opacity: 0.9;">Email Verification Required</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #333; margin-top: 0;">Hi ${name}!</h2>
                      <p>Thank you for registering with MotluPets. Please verify your email address using the code below:</p>
                      
                      <!-- OTP Box -->
                      <table role="presentation" style="width: 100%; margin: 30px 0;">
                        <tr>
                          <td style="background-color: #f8f9fa; border: 2px solid #4a90e2; padding: 20px; text-align: center; border-radius: 6px;">
                            <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code:</p>
                            <div style="font-size: 28px; font-weight: bold; color: #4a90e2; letter-spacing: 3px; margin: 10px 0;">${otp}</div>
                            <p style="margin: 0; color: #666; font-size: 12px;">Enter this code to complete verification</p>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #d73502; font-weight: bold; margin: 20px 0;">
                        This code expires in 10 minutes for your security.
                      </p>
                      
                      <p><strong>Security Notes:</strong></p>
                      <ul style="margin: 0; padding-left: 20px;">
                        <li>Do not share this code with anyone</li>
                        <li>MotluPets will never ask for your verification code</li>
                        <li>If you did not request this, please ignore this email</li>
                      </ul>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 30px 40px; text-align: center; color: #666; font-size: 14px;">
                      <p style="margin: 0 0 10px 0;"><strong>MotluPets</strong></p>
                      <p style="margin: 0; font-size: 12px;">Need help? Contact support@motlupets.com</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    const result = await sgMail.send(mailOptions);
    console.log('Verification OTP sent successfully to:', email);
    return result;

  } catch (error) {
    console.error('❌ Failed to send verification OTP:', error);
    throw error;
  }
};

module.exports = {
  sendOrderConfirmationEmail,
  sendVerificationOTP,
  generateOTP
};
