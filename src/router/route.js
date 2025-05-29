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
    const uploadDir = 'uploads/';
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
router.get("/TicketCategory/GETALL", TicketController.showTicketCategory);
router.post("/TicketCategory/NewTicketCategory", TicketController.createTicketCategory);
router.post("/TicketCategory/UpdateTicketCategory", TicketController.updateTicketCategory);
router.post("/TicketCategory/DeleteTicketCategory", TicketController.deleteTicketCategory);
router.post("/Ticket/Newticketdetails", TicketController.createticketdetail);
router.get("/Ticket/GETticketDetails", TicketController.showticketDetails);
router.post("/Ticket/UpdateStatusTicketDetails", TicketController.ticketchangestatus);
router.post("/Ticket/TicketDetailsReassign", TicketController.ticketdetailsreassign);
router.post("/Ticket/OpenImage", TicketController.openImage);
router.post("/Ticket/NewStatus", TicketController.createsystemstatus);
router.post("/Ticket/UpdateStatus", TicketController.updatesystemstatus);
router.post("/Ticket/DeleteStatus", TicketController.deletesystemstatus);
router.get("/Ticket/GETALLStatus", TicketController.showSystemStatus);

router.get("/Priority/GETALL", PriorityController.showPriority);
router.post("/Priority/NewPriority", PriorityController.createPriority);
router.post("/Priority/UpdatePriority", PriorityController.updatePriority);
router.post("/Priority/DeletePriority", PriorityController.deletePriority);
router.get("/GroupAirline/GETALL", GroupAirlineController.showgroupline);
router.post("/GroupAirline/NewGroupAirline", GroupAirlineController.creategroupline);
router.post("/GroupAirline/DeleteGroupAirline", GroupAirlineController.deletegroupline);
router.post("/GroupAirline/UpdateGroupAirline", GroupAirlineController.updategroupline);
router.post("/GroupAirLine/NewGroupAirLineDetails", GroupAirlineController.newairlinedetails);
router.get("/GroupAirline/GETGroupAirlineDetails", GroupAirlineController.showairlinedetails);
router.post("/GroupAirline/UpdateGroupAirlineDetails", GroupAirlineController.updategroupairlinedetails);
router.post("/GroupAirline/DeleteGroupAirlineDetails", GroupAirlineController.deletegroupairlinedetails);
router.get("/Announcement/GETALLTargetaudience", AnnoucementController.showannouncement);
router.post("/Announcement/NewTargetaudience", AnnoucementController.newtargetaudience);
router.post("/Announcement/DeleteTargetaudience", AnnoucementController.deletetargetaudience);
router.post("/Announcement/UpdateTargetaudience", AnnoucementController.updatetargetaudience);

export default router;
