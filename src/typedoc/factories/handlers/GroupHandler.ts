module TypeDoc.Factories
{
    /**
     * A handler that sorts and groups the found reflections in the resolving phase.
     *
     * The handler sets the ´groups´ property of all reflections.
     */
    export class GroupHandler extends BaseHandler
    {
        /**
         * Define the sort order of reflections.
         */
        static WEIGHTS = [
            TypeScript.PullElementKind.DynamicModule,
            TypeScript.PullElementKind.Container,
            TypeScript.PullElementKind.Enum,
            TypeScript.PullElementKind.Interface,
            TypeScript.PullElementKind.Class,
            TypeScript.PullElementKind.ObjectLiteral,
            TypeScript.PullElementKind.EnumMember,
            TypeScript.PullElementKind.ConstructorMethod,
            TypeScript.PullElementKind.Property,
            TypeScript.PullElementKind.GetAccessor,
            TypeScript.PullElementKind.SetAccessor,
            TypeScript.PullElementKind.Method,
            TypeScript.PullElementKind.Function,
            TypeScript.PullElementKind.Variable
        ];

        /**
         * Define the singular name of individual reflection kinds.
         */
        static SINGULARS = (function() {
            var singulars = {};
            singulars[TypeScript.PullElementKind.Container]  = 'Module';
            singulars[TypeScript.PullElementKind.Enum]       = 'Enumeration';
            singulars[TypeScript.PullElementKind.EnumMember] = 'Enumeration member';
            return singulars;
        })();

        /**
         * Define the plural name of individual reflection kinds.
         */
        static PLURALS = (function() {
            var plurals = {};
            plurals[TypeScript.PullElementKind.Container]  = 'Modules';
            plurals[TypeScript.PullElementKind.Class]      = 'Classes';
            plurals[TypeScript.PullElementKind.Property]   = 'Properties';
            plurals[TypeScript.PullElementKind.Enum]       = 'Enumerations';
            plurals[TypeScript.PullElementKind.EnumMember] = 'Enumeration members';
            return plurals;
        })();



        /**
         * Create a new GroupHandler instance.
         *
         * @param dispatcher  The dispatcher this handler should be attached to.
         */
        constructor(dispatcher:Dispatcher) {
            super(dispatcher);

            dispatcher.on(Dispatcher.EVENT_END_RESOLVE, this.onEndResolve, this);
        }


        /**
         * Triggered once after all documents have been read and the dispatcher
         * leaves the resolving phase.
         */
        private onEndResolve(event:DispatcherEvent) {
            function walkDirectory(directory) {
                directory.groups = GroupHandler.getReflectionGroups(directory.getAllReflections());

                for (var key in directory.directories) {
                    if (!directory.directories.hasOwnProperty(key)) continue;
                    walkDirectory(directory.directories[key]);
                }
            }

            var project = event.project;
            if (project.children && project.children.length > 0) {
                project.children.sort(GroupHandler.sortCallback);
                project.groups = GroupHandler.getReflectionGroups(project.children);
            }

            project.reflections.forEach((reflection) => {
                // if (reflection.kindOf(Models.Kind.SomeSignature)) return;
                // if (!reflection.children || reflection.children.length == 0) return;

                reflection.children.sort(GroupHandler.sortCallback);
                reflection.kindString = GroupHandler.getKindSingular(reflection.kind);
                reflection.groups     = GroupHandler.getReflectionGroups(reflection.children);
            });

            walkDirectory(project.directory);
            project.files.forEach((file) => {
                file.groups = GroupHandler.getReflectionGroups(file.reflections);
            });
        }


        /**
         * Create a grouped representation of the given list of reflections.
         *
         * Reflections are grouped by kind and sorted by weight and name.
         *
         * @param reflections  The reflections that should be grouped.
         * @returns An array containing all children of the given reflection grouped by their kind.
         */
        static getReflectionGroups(reflections:Models.DeclarationReflection[]):Models.ReflectionGroup[] {
            var groups:Models.ReflectionGroup[] = [];
            reflections.forEach((child) => {
                for (var i = 0; i < groups.length; i++) {
                    var group = groups[i];
                    if (group.kind != child.kind) {
                        continue;
                    }

                    group.children.push(child);
                    return;
                }

                var group = new Models.ReflectionGroup(GroupHandler.getKindPlural(child.kind), child.kind);
                group.children.push(child);
                groups.push(group);
            });

            groups.forEach((group) => {
                var someExported = false, allInherited = true, allPrivate = true, allExternal = true;
                group.children.forEach((child) => {
                    someExported = child.isExported    || someExported;
                    allInherited = child.inheritedFrom && allInherited;
                    allPrivate   = child.isPrivate     && allPrivate;
                    allExternal  = child.isExternal    && allExternal;
                });

                group.someChildrenAreExported = someExported;
                group.allChildrenAreInherited = allInherited;
                group.allChildrenArePrivate   = allPrivate;
                group.allChildrenAreExternal  = allExternal;
            });

            return groups;
        }


        /**
         * Transform the internal typescript kind identifier into a human readable version.
         *
         * @param kind  The original typescript kind identifier.
         * @returns A human readable version of the given typescript kind identifier.
         */
        private static getKindString(kind:TypeScript.PullElementKind):string {
            var str = TypeScript.PullElementKind[kind];
            str = str.replace(/(.)([A-Z])/g, (m, a, b) => a + ' ' + b.toLowerCase());
            return str;
        }


        /**
         * Return the singular name of a internal typescript kind identifier.
         *
         * @param kind The original internal typescript kind identifier.
         * @returns The singular name of the given internal typescript kind identifier
         */
        static getKindSingular(kind:TypeScript.PullElementKind):string {
            if (GroupHandler.SINGULARS[kind]) {
                return GroupHandler.SINGULARS[kind];
            } else {
                return GroupHandler.getKindString(kind);
            }
        }


        /**
         * Return the plural name of a internal typescript kind identifier.
         *
         * @param kind The original internal typescript kind identifier.
         * @returns The plural name of the given internal typescript kind identifier
         */
        static getKindPlural(kind:TypeScript.PullElementKind):string {
            if (GroupHandler.PLURALS[kind]) {
                return GroupHandler.PLURALS[kind];
            } else {
                return this.getKindString(kind) + 's';
            }
        }


        /**
         * Callback used to sort reflections by weight defined by ´GroupHandler.WEIGHTS´ and name.
         *
         * @param a The left reflection to sort.
         * @param b The right reflection to sort.
         * @returns The sorting weight.
         */
        static sortCallback(a:Models.DeclarationReflection, b:Models.DeclarationReflection):number {
            var aWeight = GroupHandler.WEIGHTS.indexOf(a.kind);
            var bWeight = GroupHandler.WEIGHTS.indexOf(b.kind);
            if (aWeight == bWeight) {
                if (a.name == b.name) return 0;
                return a.name > b.name ? 1 : -1;
            } else return aWeight - bWeight;
        }
    }


    /**
     * Register this handler.
     */
    Dispatcher.HANDLERS.push(GroupHandler);
}