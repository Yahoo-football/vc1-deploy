const bcrypt = require('bcryptjs');
const {
  sequelize,
  User,
  Field,
  Team,
  TeamMember,
  Booking,
  BookingJoinRequest,
  MatchResult,
  Notification,
  Rating,
  RoleRequest
} = require('../models');

const PASSWORD = 'Password123';
const DEFAULT_AVATAR = '/uploads/profile/default_profile.jpg';
const DEFAULT_FIELD_IMAGE = '/hero-manu.jpg';

const FIELD_NAMES = [
  'Victory Arena',
  'Skyline Turf',
  'Mekong Stadium',
  'Golden Boots Center',
  'Capital Football Hub',
  'Night Lights Field',
  'River Park Pitch',
  'Weekend Sports Ground',
  'Phoenix Arena',
  'Lion City Turf',
  'United Sports Base',
  'Prime Match Field',
  'Goal Factory',
  'Champions Yard',
  'Royal Kickoff Park'
];

const TEAM_NAMES = [
  'Mekong United',
  'City Warriors',
  'Golden Boots',
  'Night Strikers',
  'Royal Tigers',
  'Skyline FC',
  'Victory Eleven',
  'Capital Rangers',
  'Phoenix Squad',
  'Weekend Stars',
  'River Eagles',
  'Lion Hearts',
  'Thunder Club',
  'Prime Shooters',
  'Legend XI'
];

const firstNames = [
  'Admin',
  'Dara',
  'Nita',
  'Sokha',
  'Vanna',
  'Malis',
  'Rin',
  'Piseth',
  'Dalin',
  'Sreyna',
  'Kanha',
  'Ratha',
  'Narin',
  'Sophy',
  'Ravy'
];

const lastNames = [
  'Manager',
  'Owner',
  'Owner',
  'Owner',
  'Captain',
  'Captain',
  'Captain',
  'Captain',
  'Captain',
  'Player',
  'Player',
  'Player',
  'Player',
  'Player',
  'Player'
];

const roles = [
  'admin',
  'field_owner',
  'field_owner',
  'field_owner',
  'captain',
  'captain',
  'captain',
  'captain',
  'captain',
  'player',
  'player',
  'player',
  'player',
  'player',
  'player'
];

const statuses = [
  'active',
  'active',
  'active',
  'active',
  'active',
  'active',
  'active',
  'inactive',
  'active',
  'active',
  'active',
  'active',
  'suspended',
  'active',
  'active'
];

const genders = ['male', 'female', 'male', 'female', 'male', 'female', 'male', 'male', 'female', 'female', 'male', 'male', 'female', 'female', 'male'];
const skillLevels = ['beginner', 'intermediate', 'advanced', 'professional'];
const fieldTypes = ['5v5', '7v7', '11v11', 'futsal'];
const surfaceTypes = ['artificial_turf', 'natural_grass', 'concrete', 'indoor'];
const fieldStatuses = ['available', 'available', 'available', 'available', 'maintenance', 'unavailable'];
const provinces = ['Phnom Penh', 'Kandal', 'Siem Reap', 'Battambang', 'Kampot'];
const amenitiesPool = [
  ['parking', 'showers', 'lights'],
  ['parking', 'water', 'seating'],
  ['wifi', 'changing room', 'lights'],
  ['parking', 'coffee', 'seating'],
  ['water', 'showers', 'locker room']
];

const dayOffsets = [-18, -16, -14, -12, -10, -8, -6, -4, -2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SESSION_START_HOURS = {
  morning: [8, 9, 10],
  afternoon: [12, 14, 16],
  evening: [18, 19, 20]
};

// Create date for the current flow.
const createDate = (dayOffset, hour, durationHours = 2) => {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + durationHours);
  return { start, end };
};

const operatingHours = {
  monday: { open: '08:00', close: '22:00' },
  tuesday: { open: '08:00', close: '22:00' },
  wednesday: { open: '08:00', close: '22:00' },
  thursday: { open: '08:00', close: '22:00' },
  friday: { open: '08:00', close: '22:00' },
  saturday: { open: '08:00', close: '22:00' },
  sunday: { open: '08:00', close: '22:00' }
};

// Support seed database for this module.
const seedDatabase = async () => {
  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    const hashedPassword = await bcrypt.hash(PASSWORD, 12);

    const users = [];
    for (let index = 0; index < 15; index += 1) {
      const user = await User.create({
        username: `${roles[index]}${index + 1}`,
        email: `${roles[index]}${index + 1}@example.com`,
        password: hashedPassword,
        firstName: firstNames[index],
        lastName: lastNames[index],
        phone: `01234${String(index + 1).padStart(4, '0')}`,
        role: roles[index],
        status: statuses[index],
        avatarUrl: DEFAULT_AVATAR,
        dateOfBirth: `199${index % 10}-0${(index % 8) + 1}-1${index % 9}`,
        gender: genders[index],
        address: `Street ${index + 10}, ${provinces[index % provinces.length]}, Cambodia`,
        emailVerified: true,
        lastLogin: new Date(Date.now() - index * 86400000)
      });
      users.push(user);
    }

    const admin = users[0];
    const owners = users.slice(1, 4);
    const captains = users.slice(4, 9);
    const players = users.slice(9);

    const fields = [];
    for (let index = 0; index < 15; index += 1) {
      const owner = owners[index % owners.length];
      const field = await Field.create({
        name: FIELD_NAMES[index],
        description: `${FIELD_NAMES[index]} is a demo venue with strong traffic for booking, team, owner, and match features.`,
        address: `Street ${120 + index}, ${provinces[index % provinces.length]}`,
        city: provinces[index % provinces.length],
        province: provinces[(index + 1) % provinces.length],
        latitude: 11.55 + index * 0.01,
        longitude: 104.88 + index * 0.01,
        ownerId: owner.id,
        pricePerHour: 35 + index * 3,
        discountPercent: index % 4 === 0 ? 15 : index % 5 === 0 ? 10 : 0,
        operatingHours,
        fieldType: fieldTypes[index % fieldTypes.length],
        surfaceType: surfaceTypes[index % surfaceTypes.length],
        capacity: 10 + (index % 8) * 2,
        status: fieldStatuses[index % fieldStatuses.length],
        amenities: amenitiesPool[index % amenitiesPool.length],
        images: [DEFAULT_FIELD_IMAGE],
        rating: (3.5 + (index % 5) * 0.3).toFixed(2),
        totalRatings: 8 + index
      });
      fields.push(field);
    }

    const teams = [];
    for (let index = 0; index < 15; index += 1) {
      const captain = captains[index % captains.length];
      const team = await Team.create({
        name: TEAM_NAMES[index],
        description: `${TEAM_NAMES[index]} is sample team ${index + 1} used to display team, booking, and match features.`,
        captainId: captain.id,
        maxPlayers: 11 + (index % 5),
        skillLevel: skillLevels[index % skillLevels.length],
        homeFieldId: fields[index % fields.length].id,
        logoUrl: null,
        isActive: index % 6 !== 0
      });
      teams.push(team);
    }

    const teamMembers = [];
    for (let index = 0; index < teams.length; index += 1) {
      teamMembers.push({
        teamId: teams[index].id,
        userId: teams[index].captainId,
        role: 'captain',
        status: 'active',
        joinedAt: new Date(Date.now() - (index + 3) * 86400000),
        isActive: true
      });
    }

    for (let index = 0; index < 15; index += 1) {
      const player = players[index % players.length];
      teamMembers.push({
        teamId: teams[index].id,
        userId: player.id,
        role: index % 4 === 0 ? 'substitute' : 'player',
        status: index % 5 === 0 ? 'pending' : 'active',
        joinedAt: index % 5 === 0 ? null : new Date(Date.now() - (index + 1) * 43200000),
        isActive: index % 7 !== 0
      });
    }

    await TeamMember.bulkCreate(teamMembers);

    const bookings = [];
    const completedBookingIndexes = [];

    for (let index = 0; index < 30; index += 1) {
      const team = teams[index % teams.length];
      const field = fields[index % fields.length];
      const opponentTeam = index < 15 ? teams[(index + 5) % teams.length] : null;
      const rotatingHours = [
        ...SESSION_START_HOURS.morning,
        ...SESSION_START_HOURS.afternoon,
        ...SESSION_START_HOURS.evening
      ];
      const startHour = rotatingHours[index % rotatingHours.length];
      const { start, end } = createDate(dayOffsets[index % dayOffsets.length], startHour, index % 3 === 0 ? 1 : 2);

      let status = 'pending';
      if (index < 15) {
        status = 'completed';
        completedBookingIndexes.push(index);
      } else if (index < 21) {
        status = 'confirmed';
      } else if (index < 25) {
        status = 'pending';
      } else {
        status = 'cancelled';
      }

      bookings.push({
        fieldId: field.id,
        teamId: team.id,
        opponentTeamId: opponentTeam ? opponentTeam.id : null,
        startTime: start,
        endTime: end,
        status,
        totalPrice: Number(field.pricePerHour) * ((end - start) / 3600000),
        specialRequests: index % 4 === 0 ? 'Need extra bibs and water.' : null,
        createdBy: team.captainId,
        isMatchmaking: index >= 21 && index < 26,
        notes: `Demo booking ${index + 1}`
      });
    }

    // Add recent booking activity for every field across all three sessions
    // so landing-page popularity stars can be verified against real bookings.
    const extraSessionBookings = [];
    fields.forEach((field, fieldIndex) => {
      const owningTeam = teams[fieldIndex % teams.length];
      const opposingTeam = teams[(fieldIndex + 5) % teams.length];

      [
        { key: 'morning', dayOffset: -3, durationHours: 2, status: 'completed', slots: SESSION_START_HOURS.morning.slice(0, 2) },
        { key: 'afternoon', dayOffset: -2, durationHours: 2, status: 'completed', slots: SESSION_START_HOURS.afternoon.slice(0, 2) },
        { key: 'evening', dayOffset: -1, durationHours: 2, status: 'confirmed', slots: SESSION_START_HOURS.evening }
      ].forEach((session) => {
        session.slots.forEach((hour, slotIndex) => {
          const { start, end } = createDate(session.dayOffset - (slotIndex % 2), hour, session.durationHours);

          extraSessionBookings.push({
            fieldId: field.id,
            teamId: owningTeam.id,
            opponentTeamId: slotIndex % 2 === 0 ? opposingTeam.id : null,
            startTime: start,
            endTime: end,
            status: session.status,
            totalPrice: Number(field.pricePerHour) * ((end - start) / 3600000),
            specialRequests: session.key === 'evening' ? 'Need lights ready before kickoff.' : null,
            createdBy: owningTeam.captainId,
            isMatchmaking: session.key === 'evening' && slotIndex === session.slots.length - 1,
            notes: `Seeded ${session.key} session booking for ${field.name}`
          });
        });
      });
    });

    bookings.push(...extraSessionBookings);

    const createdBookings = await Booking.bulkCreate(bookings);

    const matchResults = [];
    for (let index = 0; index < 15; index += 1) {
      const booking = createdBookings[index];
      const homeTeam = teams[index % teams.length];
      const awayTeam = teams[(index + 5) % teams.length];
      const mvp = players[index % players.length];
      matchResults.push({
        bookingId: booking.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: (index + 2) % 6,
        awayScore: (index + 1) % 5,
        matchStatus: 'completed',
        mvpPlayerId: mvp.id,
        matchNotes: `Completed demo match ${index + 1}`,
        recordedAt: new Date(),
        recordedBy: owners[index % owners.length].id,
        matchEvents: [
          { minute: 12, type: 'goal', teamId: homeTeam.id },
          { minute: 39, type: 'goal', teamId: awayTeam.id }
        ]
      });
    }
    await MatchResult.bulkCreate(matchResults);

    const bookingJoinRequests = [];
    for (let index = 0; index < 15; index += 1) {
      const booking = createdBookings[21 + (index % 4)];
      const requesterTeam = teams[(index + 8) % teams.length];
      const requesterCaptain = captains[(index + 1) % captains.length];
      const status = index % 5 === 0 ? 'accepted' : index % 3 === 0 ? 'rejected' : 'pending';

      bookingJoinRequests.push({
        bookingId: booking.id,
        requesterTeamId: requesterTeam.id,
        requesterCaptainId: requesterCaptain.id,
        message: `Demo join request ${index + 1} from ${requesterTeam.name}`,
        status,
        respondedAt: status === 'pending' ? null : new Date(),
        respondedBy: status === 'pending' ? null : booking.createdBy
      });
    }
    await BookingJoinRequest.bulkCreate(bookingJoinRequests);

    const ratings = [];
    for (let index = 0; index < 15; index += 1) {
      const booking = createdBookings[index];
      const raterTeam = teams[index % teams.length];
      const ratedTeam = teams[(index + 5) % teams.length];
      ratings.push({
        teamIdRater: raterTeam.id,
        teamIdRated: ratedTeam.id,
        bookingId: booking.id,
        rating: (index % 5) + 1,
        review: `Sample review ${index + 1} for ${ratedTeam.name}.`,
        sportsmanshipScore: ((index + 2) % 5) + 1,
        ratingType: 'overall',
        isRecommended: index % 2 === 0
      });
    }
    await Rating.bulkCreate(ratings);

    const roleRequests = [];
    const roleRequestUsers = [...players, ...captains, ...owners, admin].slice(0, 15);
    for (let index = 0; index < 15; index += 1) {
      const status = index % 4 === 0 ? 'approved' : index % 4 === 1 ? 'rejected' : 'pending';
      roleRequests.push({
        requesterId: roleRequestUsers[index].id,
        requestedRole: index % 2 === 0 ? 'captain' : 'field_owner',
        status,
        note: `Role request demo ${index + 1}`,
        reviewedBy: status === 'pending' ? null : admin.id,
        reviewedAt: status === 'pending' ? null : new Date(Date.now() - index * 3600000)
      });
    }
    await RoleRequest.bulkCreate(roleRequests);

    const notifications = [];
    const notificationUsers = [...users];
    for (let index = 0; index < 15; index += 1) {
      const recipient = notificationUsers[index % notificationUsers.length];
      const type = index % 5 === 0 ? 'team_invite' : index % 5 === 1 ? 'booking' : index % 5 === 2 ? 'field_update' : index % 5 === 3 ? 'match_result' : 'system';
      notifications.push({
        userId: recipient.id,
        title: `Demo notification ${index + 1}`,
        message: `This is sample notification ${index + 1} for ${recipient.username}.`,
        type,
        isRead: index % 4 === 0,
        readAt: index % 4 === 0 ? new Date() : null,
        metadata: {
          event: `demo_event_${index + 1}`,
          bookingId: createdBookings[index % createdBookings.length].id,
          teamId: teams[index % teams.length].id,
          fieldId: fields[index % fields.length].id
        }
      });
    }
    await Notification.bulkCreate(notifications);

    const counts = {
      users: await User.count(),
      fields: await Field.count(),
      teams: await Team.count(),
      teamMembers: await TeamMember.count(),
      bookings: await Booking.count(),
      bookingJoinRequests: await BookingJoinRequest.count(),
      matchResults: await MatchResult.count(),
      notifications: await Notification.count(),
      ratings: await Rating.count(),
      roleRequests: await RoleRequest.count()
    };

    console.log('Database seeded successfully with demo data.');
    console.log('\nSample login accounts');
    console.log('Admin: admin1@example.com / Password123');
    console.log('Field owner: field_owner2@example.com / Password123');
    console.log('Captain: captain5@example.com / Password123');
    console.log('Player: player10@example.com / Password123');
    console.log('\nInserted record counts');
    Object.entries(counts).forEach(([key, value]) => {
      console.log(`- ${key}: ${value}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
