const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');
const { teamValidation, idValidation } = require('../middleware/validation');

// Protected routes
router.get('/my-teams', auth, teamController.getMyTeams);
router.get('/my-invitations', auth, teamController.getMyInvitations);
router.get('/captained', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), teamController.getCaptainedTeams);

router.get('/', auth, teamController.getAllTeams);
router.get('/:id', auth, ...idValidation, teamController.getTeamById);
router.get('/:id/matches', auth, ...idValidation, teamController.getTeamMatchHistory);
router.post('/', auth, checkRole(['player', 'captain', 'field_owner']), ...teamValidation.create, teamController.createTeam);
router.put('/:id', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.updateTeam);
router.delete('/:id', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.deleteTeam);

// Team membership flows
router.post('/:id/join', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.requestJoinTeam);
router.post('/:id/leave', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.leaveTeam);
router.post('/:id/leave-requests/:userId/respond', auth, ...idValidation, teamController.respondLeaveRequest);
router.get('/:id/members', auth, ...idValidation, teamController.getTeamMembers);
router.get('/:id/requests', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.getJoinRequests);
router.post('/:id/members', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.addTeamMember);
router.put('/:id/members/:userId', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.updateTeamMember);
router.delete('/:id/members/:userId', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.removeTeamMember);

// Upload team logo
router.post('/:id/logo', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.uploadTeamLogo);
router.delete('/:id/logo', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, teamController.deleteTeamLogo);

// Invitation endpoints
router.post('/:id/invite', auth, checkRole(['player', 'captain', 'field_owner', 'admin']), ...idValidation, ...require('../middleware/validation').teamValidation.invite, teamController.invitePlayer);
router.post('/:id/invite/accept', auth, ...idValidation, teamController.acceptInvite);
router.post('/:id/invite/decline', auth, ...idValidation, teamController.declineInvite);

module.exports = router;
