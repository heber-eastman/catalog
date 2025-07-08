console.log('🔍 Starting diagnostic checks...');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`EMAIL_QUEUE_URL: ${process.env.EMAIL_QUEUE_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`AWS_REGION: ${process.env.AWS_REGION ? '✅ Set' : '❌ Missing'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);

// Test SQS connection
async function testSQS() {
  try {
    console.log('\n🔌 Testing SQS Connection...');
    const { SQSClient, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
    
    const sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
      requestHandler: {
        requestTimeout: 10000,
        connectionTimeout: 5000,
      },
    });

    const command = new GetQueueAttributesCommand({
      QueueUrl: process.env.EMAIL_QUEUE_URL,
      AttributeNames: ['All'],
    });

    const result = await sqsClient.send(command);
    console.log('✅ SQS connection successful');
    console.log(`   Queue name: ${result.Attributes?.QueueArn?.split(':').pop()}`);
    console.log(`   Messages available: ${result.Attributes?.ApproximateNumberOfMessages || 0}`);
    
  } catch (error) {
    console.log('❌ SQS connection failed:');
    console.log(`   Error: ${error.message}`);
  }
}

// Test database connection
async function testDatabase() {
  try {
    console.log('\n🗄️  Testing Database Connection...');
    const { Sequelize } = require('sequelize');
    
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    });

    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test table existence
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('GolfCourseInstances', 'StaffUsers', 'Customers')
      ORDER BY table_name;
    `);
    
    console.log(`   Tables found: ${results.map(r => r.table_name).join(', ')}`);
    
    await sequelize.close();
    
  } catch (error) {
    console.log('❌ Database connection failed:');
    console.log(`   Error: ${error.message}`);
  }
}

// Test email queue function
async function testEmailQueue() {
  try {
    console.log('\n📧 Testing Email Queue Function...');
    const { enqueueEmailNonBlocking } = require('./src/emailQueue');
    
    await enqueueEmailNonBlocking('SignupConfirmation', 'test@example.com', {
      confirmation_link: 'https://test.example.com/confirm?token=test',
      course_name: 'Test Course',
    });
    
    console.log('✅ Email queue function executed without errors');
    
  } catch (error) {
    console.log('❌ Email queue function failed:');
    console.log(`   Error: ${error.message}`);
  }
}

// Run all tests
async function runDiagnostics() {
  await testSQS();
  await testDatabase();
  await testEmailQueue();
  
  console.log('\n🎯 Diagnostic complete!');
  process.exit(0);
}

runDiagnostics().catch(error => {
  console.error('\n💥 Diagnostic failed:', error);
  process.exit(1);
}); 