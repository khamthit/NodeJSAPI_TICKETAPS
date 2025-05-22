import express from "express";
import TicketController from "../controller/ticket.controler.js";
import { auth } from "../middleware/auth.js";
import PriorityController from "../controller/priority.controller.js";
const router = express.Router();
//-------- auth -------
router.get("/TicketCategory/GETALL", TicketController.showTicketCategory);
router.post("/TicketCategory/NewTicketCategory", TicketController.createTicketCategory);
router.post("/TicketCategory/UpdateTicketCategory", TicketController.updateTicketCategory);
router.post("/TicketCategory/DeleteTicketCategory", TicketController.deleteTicketCategory);
router.get("/Priority/GETALL", PriorityController.showPriority);
router.post("/Priority/NewPriority", PriorityController.createPriority);
router.post("/Priority/UpdatePriority", PriorityController.updatePriority);
router.post("/Priority/DeletePriority", PriorityController.deletePriority);

export default router;
