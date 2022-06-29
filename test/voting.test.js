const Voting = artifacts.require("Voting.sol");
const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

contract("Voting", function (accounts) {
  const owner = accounts[0];
  const voter_1 = accounts[1];
  const voter_2 = accounts[2];
  const voter_3 = accounts[3];
  let arrayProposals = ["Cyril", "Thomas", "Zlatan", "Pires"];

  let VotingInstance;

  // ::::::::::::: ONLY OWNER ::::::::::::: //

  describe("ownable inheritance", function () {
    before(async function () {
      VotingInstance = await Voting.new({ from: owner });
    });

    it("should let owner access an onlyOwner restricted function", async () => {
      await VotingInstance.addVoter(voter_1, { from: owner });
      const storedData = await VotingInstance.getVoter.call(voter_1, {
        from: voter_1,
      });
      expect(storedData.isRegistered).to.be.true;
    });

    it("should NOT let user different than the owner to access an onlyOwner restricted function", async () => {
      await expectRevert(
        VotingInstance.addVoter(voter_2, { from: voter_1 }),
        "Ownable: caller is not the owner"
      );
    });
  });

  // ::::::::::::: ONLY VOTERS ::::::::::::: //

  describe("onlyVoters modifier", function () {
    before(async function () {
      VotingInstance = await Voting.new({ from: owner });
      await VotingInstance.addVoter(voter_1, { from: owner });
    });

    it("should let a register voter access an onlyVoters restricted function", async () => {
      const storedData = await VotingInstance.getVoter.call(voter_1, {
        from: voter_1,
      });
      expect(storedData.isRegistered).to.be.true;
    });

    it("should NOT let a non registered voter access an onlyVoters restricted function", async () => {
      await expectRevert(
        VotingInstance.getVoter.call(voter_1, {
          from: owner,
        }),
        "You're not a voter"
      );
    });
  });

  // ::::::::::::: VOTING PROCESS ::::::::::::: //

  describe("Voting process", function () {
    // ::::::::::::: ADD VOTER ::::::::::::: //
    describe("addVoter function", function () {
      before(async function () {
        VotingInstance = await Voting.new({ from: owner });
      });

      it("owner should add a new voter", async () => {
        await VotingInstance.addVoter(voter_1, { from: owner });
        const storedData = await VotingInstance.getVoter.call(voter_1, {
          from: voter_1,
        });
        expect(storedData.isRegistered).to.be.true;
      });

      it("should emit an event VoterRegistered", async () => {
        const findEvent = await VotingInstance.addVoter(voter_2, {
          from: owner,
        });
        expectEvent(findEvent, "VoterRegistered", { voterAddress: voter_2 });
      });

      it("should NOT register a voter if already registered", async () => {
        await expectRevert(
          VotingInstance.addVoter(voter_1, { from: owner }),
          "Already registered"
        );
      });

      it("should NOT register a voter if workflowStatus isn't RegisteringVoters", async () => {
        await VotingInstance.startProposalsRegistering({ from: owner });
        await expectRevert(
          VotingInstance.addVoter(voter_3, { from: owner }),
          "Voters registration is not open yet"
        );
      });
    });

    // ::::::::::::: GET VOTER ::::::::::::: //

    describe("getVoter function", function () {
      before(async function () {
        VotingInstance = await Voting.new({ from: owner });
      });

      it("should return Struct of a Voter in mapping when a Voter is added", async () => {
        await VotingInstance.addVoter(voter_1, { from: owner });
        const storedData = await VotingInstance.getVoter.call(voter_1, {
          from: voter_1,
        });

        expect(storedData.isRegistered).to.be.a("boolean");
        expect(storedData.hasVoted).to.be.a("boolean");
        expect(Number(storedData.votedProposalId)).to.be.a("number");
        expect(new BN(Number(storedData.votedProposalId)) % 1).to.be.equal(0);
      });

      //   it("should return hasVoted to false in mapping when a voter is added and didn't vote yet", async () => {
      //     await VotingInstance.addVoter(voter_2, { from: owner });
      //     const storedData = await VotingInstance.getVoter.call(voter_2, {
      //       from: voter_2,
      //     });
      //     expect(storedData.hasVoted).to.be.false;
      //   });

      //   it("should return is registered to false in mapping when a voter hasn't been added", async () => {
      //     const storedData = await VotingInstance.getVoter.call(voter_3, {
      //       from: voter_1,
      //     });
      //     expect(storedData.isRegistered).to.be.false;
      //   });
    });

    // ::::::::::::: START PROPOSALS REGISTERING ::::::::::::: //

    describe("start proposals registering", function () {
      beforeEach(async function () {
        VotingInstance = await Voting.new({ from: owner });
      });

      it("should change workflowStatus to ProposalsRegistrationStarted", async () => {
        await VotingInstance.startProposalsRegistering({ from: owner });
        const storedData = await VotingInstance.workflowStatus.call();
        expect(storedData).to.be.bignumber.equal(new BN(1));
      });

      it("should emit an event WorkflowStatusChange", async () => {
        const findEvent = await VotingInstance.startProposalsRegistering({
          from: owner,
        });
        expectEvent(findEvent, "WorkflowStatusChange", {
          previousStatus: new BN(0),
          newStatus: new BN(1),
        });
      });

      it("should NOT change workflowStatus if workFlowStatus isn't Registering Voters", async () => {
        await VotingInstance.startProposalsRegistering({ from: owner });
        await VotingInstance.endProposalsRegistering({ from: owner });
        await expectRevert(
          VotingInstance.startProposalsRegistering({ from: owner }),
          "Registering proposals cant be started now"
        );
      });
    });

    // ::::::::::::: ADD PROPOSAL ::::::::::::: //

    describe("addProposal function", function () {
      before(async function () {
        VotingInstance = await Voting.new({ from: owner });
        await Promise.all(
          [owner, voter_1, voter_2, voter_3].map((voter) =>
            VotingInstance.addVoter(voter, { from: owner })
          )
        );
        await VotingInstance.startProposalsRegistering({ from: owner });
      });

      it("should add a proposal with 0 voteCount", async () => {
        await VotingInstance.addProposal("Cyril", { from: owner });
        const storedData = await VotingInstance.getOneProposal.call(new BN(0));
        expect(storedData.description).to.be.equal("Cyril");
        expect(storedData.voteCount).to.be.bignumber.equal(new BN(0));
      });

      it("should emit an event on addProposal", async () => {
        const findEvent = await VotingInstance.addProposal("Alyra", {
          from: voter_1,
        });
        expectEvent(findEvent, "ProposalRegistered", {
          proposalId: new BN(1),
        });
      });

      it("should NOT addProposal if description is an empty string", async () => {
        await expectRevert(
          VotingInstance.addProposal("", { from: voter_2 }),
          "Vous ne pouvez pas ne rien proposer"
        );
      });

      it("should NOT addProposal if workflowStatus isn't ProposalsRegistrationStarted", async () => {
        await VotingInstance.endProposalsRegistering({ from: owner });
        await expectRevert(
          VotingInstance.addProposal("Julien", { from: voter_3 }),
          "Proposals are not allowed yet"
        );
      });
    });

    // ::::::::::::: GET ONE PROPOSAL ::::::::::::: //

    describe("getOneProposal function", function () {
      before(async function () {
        VotingInstance = await Voting.new({ from: owner });
        await VotingInstance.addVoter(voter_1, { from: owner });
        await VotingInstance.startProposalsRegistering({ from: owner });
      });

      it("should return Struct of a Proposal in array when a Proposal is added", async () => {
        await VotingInstance.addProposal("Cyril", { from: voter_1 });
        const storedData = await VotingInstance.getOneProposal.call(new BN(0), {
          from: voter_1,
        });

        expect(storedData.description).to.be.a("string");
        expect(Number(storedData.voteCount)).to.be.a("number");
        expect(new BN(Number(storedData.voteCount)) % 1).to.be.equal(0);
      });
    });

    // ::::::::::::: END PROPOSALS REGISTERING ::::::::::::: //

    describe("end proposals registering", function () {
      beforeEach(async function () {
        VotingInstance = await Voting.new({ from: owner });
      });

      it("should change workflowStatus to ProposalsRegistrationEnded", async () => {
        await VotingInstance.startProposalsRegistering({ from: owner });

        await VotingInstance.endProposalsRegistering({ from: owner });
        const storedData = await VotingInstance.workflowStatus.call();
        expect(storedData).to.be.bignumber.equal(new BN(2));
      });

      it("should emit an event WorkflowStatusChange", async () => {
        await VotingInstance.startProposalsRegistering({ from: owner });

        const findEvent = await VotingInstance.endProposalsRegistering({
          from: owner,
        });

        expectEvent(findEvent, "WorkflowStatusChange", {
          previousStatus: new BN(1),
          newStatus: new BN(2),
        });
      });

      it("should NOT change workflowStatus if workFlowStatus isn't ProposalsRegistrationStarted", async () => {
        await expectRevert(
          VotingInstance.endProposalsRegistering({ from: owner }),
          "Registering proposals havent started yet"
        );
      });
    });

    // ::::::::::::: START VOTING SESSION ::::::::::::: //

    describe("start voting session", function () {
      beforeEach(async function () {
        VotingInstance = await Voting.new({ from: owner });
        await VotingInstance.startProposalsRegistering({ from: owner });
      });

      it("should change workflowStatus to VotingSessionStarted", async () => {
        await VotingInstance.endProposalsRegistering({ from: owner });
        await VotingInstance.startVotingSession({ from: owner });
        const storedData = await VotingInstance.workflowStatus.call();
        expect(storedData).to.be.bignumber.equal(new BN(3));
      });

      it("should emit an event WorkflowStatusChange", async () => {
        await VotingInstance.endProposalsRegistering({ from: owner });
        const findEvent = await VotingInstance.startVotingSession({
          from: owner,
        });

        expectEvent(findEvent, "WorkflowStatusChange", {
          previousStatus: new BN(2),
          newStatus: new BN(3),
        });
      });

      it("should NOT change workflowStatus if workFlowStatus isn't ProposalsRegistrationEnded", async () => {
        await expectRevert(
          VotingInstance.startVotingSession({ from: owner }),
          "Registering proposals phase is not finished"
        );
      });
    });

    // ::::::::::::: SET VOTE ::::::::::::: //

    describe("setVote function", function () {
      before(async function () {
        VotingInstance = await Voting.new({ from: owner });
        await Promise.all(
          [owner, voter_1, voter_2, voter_3].map((voter) =>
            VotingInstance.addVoter(voter, { from: owner })
          )
        );
        await VotingInstance.startProposalsRegistering({ from: owner });
        for (let i = 0; i < arrayProposals.length; i++) {
          await VotingInstance.addProposal(arrayProposals[i], { from: owner });
        }
        await VotingInstance.endProposalsRegistering({ from: owner });
        await VotingInstance.startVotingSession({ from: owner });
      });

      it("should increase voteCount to a Proposal when voting for it", async () => {
        let votePower = new BN(1);
        let voteCountBefore = new BN(
          (await VotingInstance.getOneProposal.call(new BN(1))).voteCount
        );
        await VotingInstance.setVote(new BN(1), { from: voter_1 });
        let voteCountAfter = new BN(
          (await VotingInstance.getOneProposal.call(new BN(1))).voteCount
        );
        expect(voteCountAfter).to.be.bignumber.equal(
          voteCountBefore.add(votePower)
        );
      });

      it("should set hasVoted to true in Voter mapping", async () => {
        let voter = await VotingInstance.getVoter.call(voter_1, {
          from: voter_1,
        });
        expect(voter.hasVoted).to.be.true;
      });

      it("should set the votedProposalId to the good uint Proposal in Voter mapping", async () => {
        let voter = await VotingInstance.getVoter.call(voter_1, {
          from: voter_1,
        });
        expect(new BN(voter.votedProposalId)).to.be.bignumber.equal(new BN(1));
      });

      it("should emit an event on setVote", async () => {
        const findEvent = await VotingInstance.setVote(new BN(2), {
          from: voter_2,
        });
        expectEvent(findEvent, "Voted", {
          voter: voter_2,
          proposalId: new BN(2),
        });
      });

      it("should NOT setVote if voter have already voted", async () => {
        await expectRevert(
          VotingInstance.setVote(new BN(2), {
            from: voter_1,
          }),
          "You have already voted"
        );
      });

      it("should NOT setVote if Proposal doesn't exist", async () => {
        await expectRevert(
          VotingInstance.setVote(new BN(arrayProposals.length), {
            from: voter_3,
          }),
          "Proposal not found"
        );
      });

      it("should NOT setVote if workflowStatus isn't VotingSessionStarted", async () => {
        await VotingInstance.endVotingSession({ from: owner });
        await expectRevert(
          VotingInstance.setVote(new BN(2), {
            from: voter_3,
          }),
          "Voting session havent started yet"
        );
      });
    });

    // ::::::::::::: END VOTING SESSION ::::::::::::: //

    describe("end voting session", function () {
      beforeEach(async function () {
        VotingInstance = await Voting.new({ from: owner });
        await VotingInstance.startProposalsRegistering({ from: owner });
        await VotingInstance.endProposalsRegistering({ from: owner });
      });

      it("should change workflowStatus to VotingSessionStarted", async () => {
        await VotingInstance.startVotingSession({ from: owner });
        await VotingInstance.endVotingSession({ from: owner });

        const storedData = await VotingInstance.workflowStatus.call();
        expect(storedData).to.be.bignumber.equal(new BN(4));
      });

      it("should emit an event WorkflowStatusChange", async () => {
        await VotingInstance.startVotingSession({ from: owner });
        const findEvent = await VotingInstance.endVotingSession({
          from: owner,
        });

        expectEvent(findEvent, "WorkflowStatusChange", {
          previousStatus: new BN(3),
          newStatus: new BN(4),
        });
      });

      it("should NOT change workflowStatus if workFlowStatus isn't ProposalsRegistrationEnded", async () => {
        await expectRevert(
          VotingInstance.endVotingSession({ from: owner }),
          "Voting session havent started yet"
        );
      });
    });

    // ::::::::::::: TALLY VOTES ::::::::::::: //

    describe("tallyVotes function", function () {
      beforeEach(async function () {
        VotingInstance = await Voting.new({ from: owner });
        await Promise.all(
          [owner, voter_1, voter_2, voter_3].map((voter) =>
            VotingInstance.addVoter(voter, { from: owner })
          )
        );
        await VotingInstance.startProposalsRegistering({ from: owner });
        for (let i = 0; i < arrayProposals.length; i++) {
          await VotingInstance.addProposal(arrayProposals[i], { from: owner });
        }
        await VotingInstance.endProposalsRegistering({ from: owner });
        await VotingInstance.startVotingSession({ from: owner });
        await VotingInstance.setVote(new BN(0), { from: owner });
        await VotingInstance.setVote(new BN(2), { from: voter_1 });
        await VotingInstance.setVote(new BN(3), { from: voter_2 });
        await VotingInstance.setVote(new BN(3), { from: voter_3 });
      });

      it("should return the winningProposalId version 1", async () => {
        await VotingInstance.endVotingSession({ from: owner });
        await VotingInstance.tallyVotes({ from: owner });
        let winningProposalID = await VotingInstance.winningProposalID.call();
        expect(winningProposalID).to.be.bignumber.equal(new BN(3));
      });

      // ::::::::::::: OR ::::::::::::: //

      it("should return the winningProposalId version 2", async () => {
        await VotingInstance.endVotingSession({ from: owner });
        await VotingInstance.tallyVotes({ from: owner });
        let _winningProposalID;
        for (let i = 0; i < arrayProposals.length; i++) {
          if (
            new BN(
              (await VotingInstance.getOneProposal.call(new BN(i))).voteCount
            ) >
            new BN(
              (
                await VotingInstance.getOneProposal.call(
                  new BN(_winningProposalID)
                )
              ).voteCount
            )
          ) {
            _winningProposalID = i;
          }
        }
        let winningProposalID = await VotingInstance.winningProposalID.call();
        expect(winningProposalID).to.be.bignumber.equal(
          new BN(_winningProposalID)
        );
      });

      it("should emit an event on TallyVote", async () => {
        await VotingInstance.endVotingSession({ from: owner });
        const findEvent = await VotingInstance.tallyVotes({
          from: owner,
        });
        expectEvent(findEvent, "WorkflowStatusChange", {
          previousStatus: new BN(4),
          newStatus: new BN(5),
        });
      });

      it("should NOT Tally Votes if workflowStatus isn't VotingSessionEnded", async () => {
        await expectRevert(
          VotingInstance.tallyVotes({
            from: owner,
          }),
          "Current status is not voting session ended"
        );
      });
    });
  });
});
