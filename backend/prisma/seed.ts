import { PrismaClient, Role, RideStatus, ParcelStatus, PaymentStatus, PaymentMethod, ConversationStatus, MessageSenderRole, MessageType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

let prisma: PrismaClient;

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log('DEBUG: DATABASE_URL is', process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED');
  
  prisma = new PrismaClient();

  // Clear existing data (optional but recommended for a clean seed)
  // Order matters due to foreign key constraints
  await prisma.paymentAudit.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.parcel.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.locationHistory.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.account.deleteMany();
  await prisma.setting.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Settings
  await prisma.setting.createMany({
    data: [
      { key: 'COMMISSION_RATE', value: '0.15' },
      { key: 'MIN_FARE', value: '70' },
      { key: 'PER_KM_RATE', value: '35' },
      { key: 'PARCEL_BASE_FEE', value: '100' },
      { key: 'PARCEL_PER_KM', value: '30' },
      { key: 'SUPPORT_EMAIL', value: 'support@nduthiride.co.ke' },
      { key: 'SUPPORT_PHONE', value: '+254700000000' },
    ],
  });

  // 2. Admin Accounts
  const admin = await prisma.account.create({
    data: {
      fullName: 'NduthiRide Admin',
      email: 'admin@nduthiride.co.ke',
      phone: '+254711222333',
      passwordHash,
      role: Role.ADMIN,
      isEmailVerified: true,
    },
  });

  // 3. Riders (Verified and Active)
  const ridersData = [
    { name: 'John Kamau', phone: '+254722000111', email: 'john.kamau@example.com', bike: 'Boxer BM150', reg: 'KMCA 123A', license: 'L12345678' },
    { name: 'Peter Otieno', phone: '+254722000222', email: 'peter.otieno@example.com', bike: 'TVS HLX 125', reg: 'KMCB 456B', license: 'L87654321' },
    { name: 'David Mwangi', phone: '+254722000333', email: 'david.mwangi@example.com', bike: 'Honda Ace 125', reg: 'KMCC 789C', license: 'L11223344' },
    { name: 'Samuel Kiprop', phone: '+254722000444', email: 'samuel.kiprop@example.com', bike: 'Boxer BM150', reg: 'KMCD 012D', license: 'L55667788' },
    { name: 'Evans Juma', phone: '+254722000555', email: 'evans.juma@example.com', bike: 'Yamaha Crux', reg: 'KMCE 345E', license: 'L99001122' },
  ];

  const createdRiders: any[] = [];
  for (const r of ridersData) {
    const account = await prisma.account.create({
      data: {
        fullName: r.name,
        email: r.email,
        phone: r.phone,
        passwordHash,
        role: Role.RIDER,
        isEmailVerified: true,
        rider: {
          create: {
            bikeModel: r.bike,
            bikeRegistration: r.reg,
            licenseNumber: r.license,
            isVerified: true,
            isAvailable: Math.random() > 0.3,
            ratingAverage: 4.5 + Math.random() * 0.5,
            totalRides: Math.floor(Math.random() * 100),
            totalEarnings: Math.floor(Math.random() * 50000),
            currentLat: -1.286389 + (Math.random() - 0.5) * 0.1,
            currentLng: 36.817223 + (Math.random() - 0.5) * 0.1,
          },
        },
      },
      include: { rider: true },
    });
    if (account.rider) createdRiders.push(account.rider);
  }

  // 4. Users
  const usersData = [
    { name: 'Alice Wambui', phone: '+254711000111', email: 'alice.wambui@example.com' },
    { name: 'Brian Mutua', phone: '+254711000222', email: 'brian.mutua@example.com' },
    { name: 'Catherine Njeru', phone: '+254711000333', email: 'catherine.njeru@example.com' },
    { name: 'Daniel Odhiambo', phone: '+254711000444', email: 'daniel.odhiambo@example.com' },
    { name: 'Faith Chebet', phone: '+254711000555', email: 'faith.chebet@example.com' },
  ];

  const createdUsers: any[] = [];
  for (const u of usersData) {
    const user = await prisma.account.create({
      data: {
        fullName: u.name,
        email: u.email,
        phone: u.phone,
        passwordHash,
        role: Role.USER,
        isEmailVerified: true,
      },
    });
    createdUsers.push(user);
  }

  // 5. Locations for Nairobi context
  const locations = [
    { address: 'Westlands, Nairobi', lat: -1.2634, lng: 36.8012 },
    { address: 'Upper Hill, Nairobi', lat: -1.2989, lng: 36.8147 },
    { address: 'Kilimani, Nairobi', lat: -1.2902, lng: 36.7876 },
    { address: 'Nairobi CBD, Kenya', lat: -1.2833, lng: 36.8167 },
    { address: 'Kasarani, Nairobi', lat: -1.2183, lng: 36.8967 },
    { address: 'Langata, Nairobi', lat: -1.3262, lng: 36.7725 },
    { address: 'South C, Nairobi', lat: -1.3188, lng: 36.8329 },
    { address: 'Eastleigh, Nairobi', lat: -1.2721, lng: 36.8550 },
  ];

  // 6. Past Rides (Completed)
  for (let i = 0; i < 15; i++) {
    const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
    const rider = createdRiders[Math.floor(Math.random() * createdRiders.length)];
    const pickup = locations[Math.floor(Math.random() * locations.length)];
    const dropoff = locations[Math.floor(Math.random() * locations.length)];
    
    if (pickup.address === dropoff.address) continue;

    const fare = 150 + Math.floor(Math.random() * 300);
    const distance = 2 + Math.random() * 8;

    const ride = await prisma.ride.create({
      data: {
        userId: user.id,
        riderId: rider.id,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        status: RideStatus.COMPLETED,
        estimatedFare: fare,
        finalFare: fare,
        distanceKm: distance,
        estimatedMins: Math.ceil(distance * 3),
        completedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        payment: {
          create: {
            amount: fare,
            status: PaymentStatus.COMPLETED,
            method: Math.random() > 0.5 ? PaymentMethod.MPESA : PaymentMethod.CASH,
            mpesaReceiptNumber: Math.random() > 0.5 ? 'QK' + Math.random().toString(36).substring(2, 10).toUpperCase() : undefined,
            completedAt: new Date(),
          },
        },
        rating: {
          create: {
            userId: user.id,
            riderId: rider.id,
            score: 4 + Math.floor(Math.random() * 2),
            comment: 'Great ride, very fast!',
          },
        },
      },
    });
  }

  // 7. Past Parcels (Delivered)
  for (let i = 0; i < 10; i++) {
    const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
    const rider = createdRiders[Math.floor(Math.random() * createdRiders.length)];
    const pickup = locations[Math.floor(Math.random() * locations.length)];
    const dropoff = locations[Math.floor(Math.random() * locations.length)];

    const fee = 200 + Math.floor(Math.random() * 400);
    const distance = 3 + Math.random() * 10;

    await prisma.parcel.create({
      data: {
        userId: user.id,
        riderId: rider.id,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        itemDescription: 'Documents and small package',
        weightKg: 0.5 + Math.random() * 4.5,
        recipientName: 'Recipient ' + i,
        recipientPhone: '+254700' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
        status: ParcelStatus.DELIVERED,
        deliveryFee: fee,
        distanceKm: distance,
        deliveredAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
        payment: {
          create: {
            amount: fee,
            status: PaymentStatus.COMPLETED,
            method: PaymentMethod.MPESA,
            mpesaReceiptNumber: 'PL' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            completedAt: new Date(),
          },
        },
      },
    });
  }

  // 8. Active Rides
  const activeUser = createdUsers[0];
  const activeRider = createdRiders[0];
  const activeRide = await prisma.ride.create({
    data: {
      userId: activeUser.id,
      riderId: activeRider.id,
      pickupAddress: 'Lavington Mall, Nairobi',
      pickupLat: -1.2785,
      pickupLng: 36.7725,
      dropoffAddress: 'Prestige Plaza, Ngong Rd',
      dropoffLat: -1.2995,
      dropoffLng: 36.7915,
      status: RideStatus.IN_PROGRESS,
      estimatedFare: 250,
      distanceKm: 4.2,
      estimatedMins: 15,
      conversation: {
        create: {
          status: ConversationStatus.ACTIVE,
          messages: {
            create: [
              {
                senderAccountId: activeUser.id,
                senderRole: MessageSenderRole.USER,
                content: 'Hello, I am at the main entrance.',
                type: MessageType.TEXT,
              },
              {
                senderAccountId: activeRider.accountId,
                senderRole: MessageSenderRole.RIDER,
                content: 'Copy that, I have arrived.',
                type: MessageType.TEXT,
              },
            ],
          },
        },
      },
    },
  });

  // 9. Active Parcel
  const parcelUser = createdUsers[1];
  const parcelRider = createdRiders[1];
  await prisma.parcel.create({
    data: {
      userId: parcelUser.id,
      riderId: parcelRider.id,
      pickupAddress: 'Yaya Centre, Nairobi',
      pickupLat: -1.2911,
      pickupLng: 36.7865,
      dropoffAddress: 'Thika Road Mall (TRM)',
      dropoffLat: -1.2215,
      dropoffLng: 36.8855,
      itemDescription: 'Birthday Cake',
      weightKg: 2.0,
      recipientName: 'Jane Doe',
      recipientPhone: '+254712345678',
      status: ParcelStatus.PICKED_UP,
      deliveryFee: 450,
      distanceKm: 12.5,
    },
  });

  // 10. Support Tickets
  await prisma.supportTicket.createMany({
    data: [
      {
        accountId: createdUsers[2].id,
        subject: 'Payment overcharged',
        message: 'I was charged twice for my last ride to Westlands.',
        status: 'OPEN',
        priority: 'HIGH',
      },
      {
        accountId: createdRiders[2].accountId,
        subject: 'App issues',
        message: 'The map is not loading properly on my device.',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
      },
    ],
  });

  // 11. Notifications
  for (const user of createdUsers) {
    await prisma.notification.create({
      data: {
        accountId: user.id,
        title: 'Welcome to NduthiRide!',
        body: 'Enjoy your first ride with 20% discount using code FIRST20',
        type: 'PROMO',
      },
    });
  }

  console.log('✅ Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
