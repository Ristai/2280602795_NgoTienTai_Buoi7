var express = require('express');
var router = express.Router();
const mongoose = require('mongoose');
const { checkLogin } = require('../utils/authHandler.js');
const reservationModel = require('../schemas/reservations');
const inventoryModel = require('../schemas/inventories');
const cartModel = require('../schemas/cart');
const productModel = require('../schemas/products');

// GET all reservations for the logged-in user
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservations = await reservationModel.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).send(reservations);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET specific reservation by ID
router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservation = await reservationModel.findOne({ _id: req.params.id, user: userId });
        if (!reservation) {
            return res.status(404).send({ message: "Reservation not found" });
        }
        res.status(200).send(reservation);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST reserveACart (Transaction Removed for Local Testing)
router.post('/reserveACart', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let currentCart = await cartModel.findOne({ user: userId });

        if (!currentCart || currentCart.items.length === 0) {
            return res.status(400).send({ message: "Cart is empty" });
        }

        let reservationItems = [];
        let totalAmount = 0;

        for (let item of currentCart.items) {
            let product = await productModel.findById(item.product);
            let inventory = await inventoryModel.findOne({ product: item.product });

            if (!inventory || inventory.stock < item.quantity) {
                return res.status(400).send({ message: `Product ${product ? product.title : item.product} is out of stock or insufficient stock` });
            }

            // Update inventory
            inventory.stock -= item.quantity;
            inventory.reserved += item.quantity;
            await inventory.save();

            let subtotal = product.price * item.quantity;
            reservationItems.push({
                product: item.product,
                quantity: item.quantity,
                price: product.price,
                subtotal: subtotal
            });
            totalAmount += subtotal;
        }

        // Create reservation
        let newReservation = new reservationModel({
            user: userId,
            items: reservationItems,
            totalAmount: totalAmount,
            status: "actived",
            ExpiredAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        await newReservation.save();

        // Clear cart
        currentCart.items = [];
        await currentCart.save();

        res.status(201).send(newReservation);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST reserveItems (Transaction Removed for Local Testing)
router.post('/reserveItems', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let { items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).send({ message: "Items list is empty" });
        }

        let reservationItems = [];
        let totalAmount = 0;

        for (let item of items) {
            let product = await productModel.findById(item.product);
            let inventory = await inventoryModel.findOne({ product: item.product });

            if (!inventory || inventory.stock < item.quantity) {
                return res.status(400).send({ message: `Product ${product ? product.title : item.product} is out of stock or insufficient stock` });
            }

            // Update inventory
            inventory.stock -= item.quantity;
            inventory.reserved += item.quantity;
            await inventory.save();

            let subtotal = product.price * item.quantity;
            reservationItems.push({
                product: item.product,
                quantity: item.quantity,
                price: product.price,
                subtotal: subtotal
            });
            totalAmount += subtotal;
        }

        // Create reservation
        let newReservation = new reservationModel({
            user: userId,
            items: reservationItems,
            totalAmount: totalAmount,
            status: "actived",
            ExpiredAt: new Date(Date.now() + 30 * 60 * 1000)
        });

        await newReservation.save();
        res.status(201).send(newReservation);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST cancelReserve/:id (Transaction Removed for Local Testing)
router.post('/cancelReserve/:id', checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let reservation = await reservationModel.findOne({ _id: req.params.id, user: userId });

        if (!reservation) {
            return res.status(404).send({ message: "Reservation not found" });
        }

        if (reservation.status !== "actived") {
            return res.status(400).send({ message: `Cannot cancel reservation in ${reservation.status} status` });
        }

        // Return items to inventory
        for (let item of reservation.items) {
            let inventory = await inventoryModel.findOne({ product: item.product });
            if (inventory) {
                inventory.stock += item.quantity;
                inventory.reserved -= item.quantity;
                await inventory.save();
            }
        }

        reservation.status = "cancelled";
        await reservation.save();

        res.status(200).send(reservation);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
