import express from "express";
import TicketController from "../controller/ticket.controler.js";
import { auth } from "../middleware/auth.js";
import PriorityController from "../controller/priority.controller.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import GroupAirlineController from "../controller/groupairline.controller.js";
import AnnoucementController from "../controller/announcement.controller.js";

const router = express.Router();
const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Define the destination directory for uploads
    // You might want to make this configurable or create it if it doesn't exist
    const uploadDir = 'assets/images';
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Define the filename for the uploaded file
    // Using a timestamp to make filenames unique
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// const upload = multer({ storage: storage });
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

//-------- auth -------
router.get("/TicketCategory/GetAllCategory", TicketController.showTicketCategory);
router.post("/TicketCategory/NewTicketCategory", TicketController.createTicketCategory);
router.post("/TicketCategory/UpdateTicketCategory", TicketController.updateTicketCategory);
router.post("/TicketCategory/DeleteTicketCategory", TicketController.deleteTicketCategory);
router.post("/Ticket/NewticketDetails", TicketController.createticketdetail);
router.post("/Ticket/UpdateStatusTicketDetails", TicketController.ticketchangestatus);
router.post("/Ticket/UpdateStatusTicketDetailsbyAirline", TicketController.ticketchangestatusbyAirline);
router.post("/Ticket/TicketDetailsReassign", TicketController.ticketdetailsreassign);
router.post("/Ticket/OpenImage", TicketController.openImage);
router.post("/Ticket/NewStatus", TicketController.createsystemstatus);
router.post("/Ticket/UpdateStatus", TicketController.updatesystemstatus);
router.post("/Ticket/DeleteStatus", TicketController.deletesystemstatus);
router.get("/Ticket/GetAllStatus", TicketController.showSystemStatus);

router.get("/Ticket/GetTicketDetails", TicketController.showticketDetails);
router.get("/Ticket/GetTicketDeailByUser", TicketController.showticketDetailsByAdmin);
router.get("/Ticket/GetTicketDeailByAirline", TicketController.showticketDetailsByAirline);

router.post("/Ticket/NewTicketDetailChateNoteAdmin", TicketController.newticketdetailchatnoteAdmin);

router.post("/Ticket/NewTicketDetailChateNote", TicketController.newticketdetailchatnote);
router.get("/Ticket/GetTicketDetailChatNote", TicketController.showticketdetailschatnote);
router.get("/Ticket/GetTicketDetailChatNoteAirline", TicketController.showticketdetailschatnoteAirline);
router.get("/Priority/GetAllPriority", PriorityController.showPriority);
router.post("/Priority/NewPriority", PriorityController.createPriority);
router.post("/Priority/UpdatePriority", PriorityController.updatePriority);
router.post("/Priority/DeletePriority", PriorityController.deletePriority);
router.get("/GroupAirline/GetAllAirline", GroupAirlineController.showgroupline);
router.get("/GroupAirline/GetAllAirlineAirline", GroupAirlineController.showgrouplineAirline);
router.post("/GroupAirline/NewGroupAirline", GroupAirlineController.creategroupline);
router.post("/GroupAirline/DeleteGroupAirline", GroupAirlineController.deletegroupline);
router.post("/GroupAirline/UpdateGroupAirline", GroupAirlineController.updategroupline);
router.post("/GroupAirLine/NewGroupAirLineDetails", GroupAirlineController.newairlinedetails);
router.get("/GroupAirline/GetGroupAirlineDetails", GroupAirlineController.showairlinedetails);
router.get("/GroupAirline/GetGroupAirlineDetailsAirline", GroupAirlineController.showairlinedetailsAirline);
router.post("/GroupAirline/UpdateGroupAirlineDetails", GroupAirlineController.updategroupairlinedetails);
router.post("/GroupAirline/DeleteGroupAirlineDetails", GroupAirlineController.deletegroupairlinedetails);
router.get("/Announcement/GetAllTargetaudience", AnnoucementController.showannouncement);
router.post("/Announcement/NewTargetaudience", AnnoucementController.newtargetaudience);
router.post("/Announcement/DeleteTargetaudience", AnnoucementController.deletetargetaudience);
router.post("/Announcement/UpdateTargetaudience", AnnoucementController.updatetargetaudience);
router.get("/Announcement/GetAnnouncementStatus", AnnoucementController.showannouncementStatus);
router.post("/Announcement/NewAnnouncementStatus", AnnoucementController.createannouncementstatus);
router.post("/Announcement/UpdateAnnouncementStatus", AnnoucementController.updateannouncementstatus);
router.post("/Announcement/DeleteAnnouncementStatus", AnnoucementController.deleteannouncementstatus);
router.post("/Announcement/NewAnnouncementDetails", AnnoucementController.newannouncementdetails);

router.get("/Announcement/GetAnnouncementDetails", AnnoucementController.showannouncementdetails);

router.get("/Announcement/GetAnnouncementDetailsAdmin", AnnoucementController.showannouncementdetailsAdmin);

router.get("/Announcement/GetAnnouncementDetailsAirline", AnnoucementController.showannouncementbyAirline);

router.get("/Announcement/GetAnnouncementDetailsAirlineUnread", AnnoucementController.showannouncementbyAirlineUnread);
router.get("/Announcement/GetAnnouncementTargetAudienceByAnouncementId", AnnoucementController.fectannouncementdetailtargetaudiencebyAicmid);
router.post("/Announcement/ReadAnnouncementDetail", AnnoucementController.readannouncementdetail);
router.get("/Announcement/ShowAnnouncementRead", AnnoucementController.showreadannouncementdetail);
router.get("/Announcement/GetAnnouncementDetailsbyCusId", AnnoucementController.showreadannouncementdetailbytargetaudienceincusid);
router.post("/Announcement/UpdateAnnouncementDetail", AnnoucementController.updateannouncementdetailsServer);
router.post("/Announcement/UpdateAnnouncementDetailActionStatus", AnnoucementController.updateannouncementdetailActionStatus);
router.get("/TicketCategory/GetAllCategoryAirline", TicketController.showTicketCategoryairline);
router.get("/Priority/GetAllPriorityAirline", PriorityController.showPriorityAirline);
router.get("/Ticket/GetAllStatusAirline", TicketController.showSystemStatusairline);
router.post("/Ticket/DeleteTicketChatnoteAirline", TicketController.deleteticketdetailschatnoteAirline);
router.post("/Ticket/DeleteTicketChatnoteAdmin", TicketController.deleteticketdetailschatnoteAdmin);
export default router;
