'use strict';

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['intl-collator', 'lodash', 'backbone', 'url-parametrized', 'backbone-model', 'backbone-prototype-compatibility'], function (Collator, lodash, Backbone, UrlParametrized) {
            return Backbone.ModelEx = factory(Collator, lodash, Backbone.Collection, Backbone.Model, Backbone.ModelEx, UrlParametrized, Backbone.compatibility);
        });

    } else if (typeof exports !== 'undefined') {
        root.Backbone.CollectionEx = factory(root.Intl.Collator, root.lodash, root.Backbone.Collection, root.Backbone.Model, root.Backbone.ModelEx, root.UrlParametrized, root.Backbone.compatibility);

    } else {
        root.Backbone.CollectionEx = factory(root.Intl.Collator, root.lodash, root.Backbone.Collection, root.Backbone.Model, root.Backbone.ModelEx, root.UrlParametrized, root.Backbone.compatibility);
    }
}(this, function (Collator, lodash, BackboneCollection, BackboneModel, BackboneModelEx, UrlParametrized, compatibility) {
    var collator   = undefined;
    var setOptions = {
        add: true,
        remove: true,
        merge: true
    };

    /**
     * @param {Collection} collection
     */
    function buildIndexMap(collection) {
        collection._indexMap = {};

        for (var i = 0, length = collection.length; i < length; i++) {
            collection._indexMap[collection.models[i].cid] = i;
        }
    }

    /**
     * @param {String} propertyName
     * @param {String} direction
     * @param {BackboneModelEx} modelA
     * @param {BackboneModelEx} modelB
     * @returns {Number}
     */
    function compare(propertyName, direction, modelA, modelB) {
        var valueA = modelA.attributes[propertyName];
        var valueB = modelB.attributes[propertyName];

        var result = 0;

        // use natural sort for strings
        if (modelA.attributeTypes[propertyName] === BackboneModelEx.ATTRIBUTE_TYPE_STRING || modelB.attributeTypes[propertyName] === BackboneModelEx.ATTRIBUTE_TYPE_STRING) {
            if (collator === undefined) {
                collator = new Collator();
            }

            result = collator.compare(valueA, valueB);
        }
        // compare time
        else if (modelA.attributeTypes[propertyName] === BackboneModelEx.ATTRIBUTE_TYPE_TIME && modelB.attributeTypes[propertyName] === BackboneModelEx.ATTRIBUTE_TYPE_TIME) {
            var valueATime = valueA.getHours() * 60 * 60 * 1000;
            valueATime += valueA.getMinutes() * 60 * 1000;
            valueATime += valueA.getSeconds() * 1000;
            valueATime += valueA.getMilliseconds();

            var valueBTime = valueB.getHours() * 60 * 60 * 1000;
            valueBTime += valueB.getMinutes() * 60 * 1000;
            valueBTime += valueB.getSeconds() * 1000;
            valueBTime += valueB.getMilliseconds();

            // use direct value compare
            if (valueATime < valueBTime) {
                result = -1;
            }
            else if (valueATime > valueBTime) {
                result = 1;
            }
        }
        // use direct value compare
        else if (valueA < valueB) {
            result = -1;
        }
        else if (valueA > valueB) {
            result = 1;
        }

        // reverse sort?
        if (direction == Collection.DIRECTION_DESC) {
            result *= -1;
        }

        return result;
    }

    /**
     * Collection for Models
     *
     * @event {void} fetching({Collection} collection)
     * @event {void} fetched({Collection} collection)
     * @event {void} sort:comparator:changed({Collection} collection, {String} comparatorNew, {String} comparatorOld)
     * @event {void} sort:direction:changed({Collection} collection, {String} directionNew, {String} directionOld)
     * @param {Array.<BackboneModelEx>=} models
     * @param {Object} options
     */
    function Collection(models, options) {
        // copy options
        if (options !== undefined && options !== null) {
            var key = undefined;
            for (key in options) {
                if (this[key] !== undefined) {
                    this[key] = options[key];
                }
            }
        }

        // only collection with models
        if (this.model === undefined || this.model === null) {
            throw new Error('A collection must define a model.');
        }

        this.cid = lodash.uniqueId('collection');

        BackboneCollection.apply(this, arguments);
    }

    Collection.DIRECTION_ASC  = 'asc';
    Collection.DIRECTION_DESC = 'desc';

    // prototype
    Collection.prototype = Object.create(BackboneCollection.prototype, {
        /**
         * @var {Object}
         */
        _indexMap: {
            value: null,
            enumerable: true,
            configurable: true,
            writable: true
        },

        /**
         * @var {String}
         */
        cid: {
            value: null,
            enumerable: true,
            configurable: true,
            writable: true
        },

        /**
         * @var {String|Array}
         */
        comparator: {
            enumerable: true,
            configurable: true,
            get: function () {
                if (this._comparator === undefined) {
                    return 'id';
                }
                return this._comparator;
            },
            set: function (comparator) {
                if (this._comparator !== comparator) {
                    var comparatorOld = this._comparator;
                    this._comparator  = comparator;
                    if (this.cid !== null && this.cid !== undefined) {
                        this.trigger('sort:comparator:changed', this, comparator, comparatorOld);
                        this.sort();
                    }
                }
            }
        },

        /**
         * current direction
         *
         * @var {String|Array}
         */
        direction: {
            enumerable: true,
            configurable: true,
            get: function () {
                // set the direction if not setted
                if (this._direction === undefined) {
                    if (typeof this.comparator === 'array') {
                        return [Collection.DIRECTION_ASC];
                    }

                    var attributeType = this.model.getPrototypeValue('attributeTypes')[this.comparator];

                    switch (true) {
                        // sort by another collection can not work
                        case attributeType === BackboneModelEx.ATTRIBUTE_TYPE_COLLECTION:
                            throw new Error('Sorting for an attribute of type collection is not allowed.');

                        // sort by another model can not work
                        case attributeType === BackboneModelEx.ATTRIBUTE_TYPE_MODEL:
                            throw new Error('Sorting for an attribute of type model is not allowed.');

                        // sort by date always sort DESC
                        case attributeType === BackboneModelEx.ATTRIBUTE_TYPE_DATE:
                        case attributeType === BackboneModelEx.ATTRIBUTE_TYPE_DATETIME:
                        case attributeType === BackboneModelEx.ATTRIBUTE_TYPE_TIME:
                            this._direction = Collection.DIRECTION_DESC;
                            break;

                        // initial direction is
                        default:
                            this._direction = Collection.DIRECTION_ASC;
                    }
                }

                return this._direction;
            },
            set: function (direction) {
                if (this._direction !== direction) {
                    var directionOld = this._direction;
                    this._direction  = direction;
                    if (this.cid !== null && this.cid !== undefined) {
                        this.trigger('sort:direction:changed', this, direction, directionOld);
                        this.sort();
                    }
                }
            }
        },

        /**
         * option fetch silent
         *
         * @var {Boolean}
         */
        fetched: {
            value: false,
            enumerable: true,
            configurable: true,
            writable: true
        },

        /**
         * option fetch silent
         *
         * @var {Boolean}
         */
        fetchSilentDefault: {
            value: true,
            enumerable: true,
            configurable: true,
            writable: true
        },

        /**
         * collection is currently fetching
         *
         * @var {Boolean}
         */
        isFetching: {
            value: false,
            enumerable: true,
            configurable: true,
            writable: true
        },

        /**
         * default model for data
         *
         * @var {BackboneModelEx}
         */
        model: {
            value: null,
            enumerable: true,
            configurable: true,
            writable: true
        },

        /**
         * url
         * @var {String}
         */
        url: {
            enumerable: true,
            configurable: true,
            get: function () {
                // no url defined...
                if (this._url === undefined) {
                    return undefined;
                }

                // create the parser
                if (this._UrlParametrized === undefined) {
                    this._UrlParametrized     = new UrlParametrized();
                    this._UrlParametrized.url = this._url;
                }

                // parsing
                return this._UrlParametrized.parse(this);
            },
            set: function (url) {
                this._url = url;
            }
        },

        /**
         * @var {Boolean}
         */
        waitDefault: {
            value: true,
            enumerable: true,
            configurable: true,
            writable: true
        }
    });

    /**
     * retrieves a model or if not exists fetchs the model
     *
     * @param {*} id
     * @return {BackboneModelEx}
     */
    Collection.prototype.getFetch = function (id) {
        var model = this.get(id);
        if (model !== undefined) {
            return model;
        }

        var options = {};
        options[this.model.prototype.idAttribute] = id;

        model = this.createModelInstance(options);
        model.fetch({
            async: false
        });

        this.push(model);

        return model;
    };

    /**
     * creates the model instance
     * @param {Object} attrs
     * @param {Object} options
     * @return {BackboneModelEx}
     */
    Collection.prototype.createModelInstance = function (attrs, options) {
        return new this.model(attrs, options);
    };

    /**
     * Prepare a hash of attributes (or other model) to be added to this collection.
     *
     * @param attrs
     * @param options
     * @return {*}
     * @private
     */
    Collection.prototype._prepareModel = function (attrs, options) {
        if (this._isModel(attrs)) {
            if (!attrs.collection) attrs.collection = this;
            return attrs;
        }

        options            = options ? _.clone(options) : {};
        options.collection = this;
        var model          = this.createModelInstance(attrs, options);
        if (!model.validationError) return model;
        this.trigger('invalid', this, model.validationError, options);
        return false;
    };

    /**
     * @param {BackboneModelEx} model
     * @param {Object} options
     */
    Collection.prototype._addReference = function (model, options) {
        this._indexMap = null;
        return BackboneCollection.prototype._addReference.apply(this, arguments);
    };

    /**
     * @param {BackboneModelEx} model
     * @param {Object} options
     */
    Collection.prototype._removeReference = function (model, options) {
        this._indexMap = null;
        return BackboneCollection.prototype._removeReference.apply(this, arguments);
    };

    /**
     * reset of collection with full model destroy
     *
     * @returns {Collection}
     */
    Collection.prototype._reset = function () {
        this._indexMap = null;

        if (this.models !== undefined && this.models !== null) {
            var i      = 0;
            var length = this.models.length;
            for (i = 0; i < length; i++) {
                this.models[i].clearFromMemory();
            }
        }

        BackboneCollection.prototype._reset.apply(this, arguments);

        return this;
    };

    /**
     * create with default wait
     *
     * @param {BackboneModelEx} model
     * @param {Object} options
     * @returns {Collection}
     */
    Collection.prototype.create = function (model, options) {
        options      = options || {};
        options.wait = options.wait !== undefined ? options.wait : this.waitDefault;

        // fixing model url if wait is true... if the model has no url root
        // and wait ist true, the model will be added AFTER save on server
        // but this cause in an error in Backbone, because the model save method will be called
        // without an collection on the model (remember: add after save)
        if (options.wait === true && model.urlRoot === undefined) {
            model.urlRoot = this.url;
            if (this.url instanceof Function) {
                model.urlRoot = this.url.bind(this);
            }
        }

        BackboneCollection.prototype.create.call(this, model, options);

        return this;
    };

    /**
     * @param {Object} options
     * @returns {Collection}
     */
    Collection.prototype.fetch = function (options) {
        if (this.isFetching === true) {
            console.warn('Collection is currenty in fetching. Abort new fetch.');
            return this;
        }
        this.isFetching = true;

        options = options || {};
        if (options.silent === undefined) {
            options.silent = this.fetchSilentDefault;
        }

        var self             = this;
        var completeCallback = options.complete;
        options.complete     = function (jqXHR, textStatus) {
            var result = undefined;
            if (completeCallback instanceof Function) {
                result = completeCallback.call(self, jqXHR, textStatus);
            }

            self.fetched = true;
            self.trigger('fetched', self);
            self.isFetching = false;

            return result;
        };

        this.trigger('fetching', this);

        BackboneCollection.prototype.fetch.call(this, options);

        return this;
    };

    /**
     * @param {BackboneModelEx} model
     * @returns {BackboneModelEx}
     */
    Collection.prototype.getNext = function (model) {
        if (this._indexMap === null) {
            buildIndexMap(this);
        }

        if (typeof model !== 'object') {
            model = this.get(model);
        }

        var index = this._indexMap[model.cid];
        if (index === this.models.length - 1) {
            return undefined;
        }

        return this.models[index + 1];
    };

    /**
     * @param {BackboneModelEx} model
     * @returns {BackboneModelEx}
     */
    Collection.prototype.getPrevious = function (model) {
        if (this._indexMap === null) {
            buildIndexMap(this);
        }

        if (typeof model !== 'object') {
            model = this.get(model);
        }

        var index = this._indexMap[model.cid];
        if (index === 0) {
            return undefined;
        }

        return this.models[index - 1];
    };

    /**
     * save method for the whole collection
     *
     * @param {Object} options
     * @returns {Collection}
     */
    Collection.prototype.save = function (options) {
        options = options || {};

        if (options.parse === undefined) {
            options.parse = true;
        }

        var self             = this;
        var successCallback  = options.success;
        var completeCallback = options.complete;

        options.success = function (resp) {
            var method = options.reset ? 'reset' : 'set';
            self[method](resp, options);
            if (successCallback instanceof Function) {
                successCallback(self, resp, options);
            }
            self.trigger('sync', self, resp, options);
        };

        options.complete = function (jqXHR, textStatus) {
            var result = undefined;
            if (completeCallback instanceof Function) {
                result = completeCallback.call(self, jqXHR, textStatus);
            }

            self.trigger('saved', self);

            return result;
        };

        this.sync('update', this, options);

        return this;
    };

    /**
     * improved BackboneCollection.set function... taken from BackboneCollection and improved some code parts
     *
     * @param {Array.<BackboneModelEx>=} models
     * @param {Object} options
     * @returns {Array}
     */
    Collection.prototype.set = function (models, options) {
        // nothing to do
        if (models === null || models === undefined) {
            return models;
        }

        // just only array
        if ((models instanceof Array) === false) {
            if (models instanceof Object) {
                models = [models];
            }
            else {
                throw new Error('Models must be an instance of array');
            }
        }

        options = lodash.defaults({}, options, setOptions);
        if (options.parse) {
            models = this.parse(models, options);
        }

        var i                = undefined;
        var l                = undefined;
        var id               = undefined;
        var model            = undefined;
        var attrs            = undefined;
        var existing         = undefined;
        var sort             = undefined;
        var at               = options.at;
        var targetModel      = this.model;
        var sortable         = this.comparator && (at == null) && options.sort !== false;
        var sortAttr         = _.isString(this.comparator) ? this.comparator : null;
        var toAdd            = [];
        var toRemove         = [];
        var modelMap         = {};
        var add              = options.add;
        var merge            = options.merge;
        var remove           = options.remove;
        var order            = !sortable && add && remove ? [] : false;
        var modelIsNew       = false;
        var collectionLength = this.length;

        // Turn bare objects into model references, and prevent invalid models
        // from being added.
        for (i = 0, l = models.length; i < l; i++) {
            attrs = models[i] || {};
            if (attrs instanceof BackboneModel) {
                id = model = attrs;
            }
            else {
                id = attrs[targetModel.prototype.idAttribute || 'id'];
            }

            // If a duplicate is found, prevent it from being added and
            // optionally merge it into the existing model.
            if (collectionLength !== 0 && (existing = this.get(id))) {
                if (remove) {
                    modelMap[existing.cid] = true;
                }
                if (merge) {
                    attrs = attrs === model ? model.attributes : attrs;
                    if (options.parse) {
                        attrs = existing.parse(attrs, options);
                    }
                    existing.set(attrs, options);
                    if (sortable && !sort && existing.hasChanged(sortAttr)) {
                        sort = true;
                    }
                }
                models[i]  = existing;
                modelIsNew = false;
                model      = existing || model;
            }
            // If this is a new, valid model, push it to the `toAdd` list.
            else if (add) {
                model = models[i] = this._prepareModel(attrs, options);
                if (!model) {
                    continue;
                }
                modelIsNew = true;
                toAdd.push(model);
                this._addReference(model, options);
            }

            // Do not add multiple models with the same `id`.
            if (order && (modelIsNew || !modelMap[model.id])) {
                order.push(model);
            }
            modelMap[model.id] = true;
        }

        // Remove nonexistent models if appropriate.
        if (remove) {
            for (i = 0, l = collectionLength; i < l; ++i) {
                if (!modelMap[(model = this.models[i]).cid]) {
                    toRemove.push(model);
                }
            }
            if (toRemove.length) {
                this.remove(toRemove, options);
            }
        }

        // See if sorting is needed, update `length` and splice in new models.
        if (toAdd.length || (order && order.length)) {
            if (sortable) {
                sort = true;
            }
            this.length += toAdd.length;
            if (at != null) {
                for (i = 0, l = toAdd.length; i < l; i++) {
                    this.models.splice(at + i, 0, toAdd[i]);
                }
            }
            else {
                if (order) {
                    this.models.length = 0;
                }
                var orderedModels = order || toAdd;
                for (i = 0, l = orderedModels.length; i < l; i++) {
                    this.models.push(orderedModels[i]);
                }
            }
        }

        // Silently sort the collection if appropriate.
        if (sort) {
            this.sort({
                silent: true
            });
        }

        // Unless silenced, it's time to fire all appropriate add/sort events.
        if (!options.silent) {
            for (i = 0, l = toAdd.length; i < l; i++) {
                (model = toAdd[i]).trigger('add', model, this, options);
            }
            if (sort || (order && order.length)) {
                this.trigger('sort', this, options);
            }
        }

        // Return the added (or merged) model (or models).
        return models;
    };

    /**
     * Force the collection to re-sort itself. You don't need to call this under
     * normal circumstances, as the set will maintain sort order as each item
     * is added.
     *
     * overwritten to implement natural sort
     * @param {Object} options
     * @returns {Collection}
     */
    Collection.prototype.sort = function (options) {
        var propertyName = this.comparator;
        if (this.models === undefined || this.models === null || this.models.length === 0 || propertyName === undefined || propertyName === null) {
            return this;
        }

        this._indexMap = null;

        var direction = this.direction;

        if (typeof propertyName === 'string') {
            this.models.sort(compare.bind(this, propertyName, direction));
        }
        else if (propertyName instanceof Array) {
            if ((direction instanceof Array) === false) {
                direction = [direction];
            }

            this.models.sort(function (modelA, modelB) {
                var result             = undefined;
                var propertyNameToSort = undefined;
                var directionToSort    = undefined;

                for (var i = 0; i < propertyName.length; i++) {
                    propertyNameToSort = propertyName[i];
                    directionToSort    = direction[0];
                    if (i < direction.length) {
                        directionToSort = direction[i];
                    }

                    result = compare(propertyNameToSort, directionToSort, modelA, modelB);
                    if (result !== 0) {
                        return result;
                    }
                }

                return 0;
            });
        }

        options = options || {};
        if (options.silent === undefined || options.silent === false) {
            this.trigger('sort', this, options);
        }

        return this;
    };

    return compatibility(Collection);
}));
