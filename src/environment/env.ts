/**
 * ShadowX
 * 
 * Part of the "JS2Scratch" Project
 * 
 * [2024]
 * [ Made with love <3 ]
 *
 * @lisence MIT
 */

import { errorMessages } from "../lib/console";
import * as validate from './validate';
import * as path from 'path';
import * as fs from 'fs';
import * as build from './build/build';

import { createCostume, createSound, createSprite } from "../template/sprite";
import { createProject } from "../template/project";
import { readFile } from "../lib/fs";
import { Costume, Sound, Sprite } from "../class/Sprite";
import chalk from "chalk";
import { PassThrough } from "stream";
import { json } from "stream/consumers";

/**
 * Gets the directory from a given path.
 * @param givenPath The path to resolve.
 * @returns The resolved directory path.
 */
function getDirectory(givenPath: string): string {
    const resolvedPath = path.resolve(givenPath);

    if (!fs.existsSync(resolvedPath)) {
        errorMessages["No such input directory"](givenPath);
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
        errorMessages["Input directory was a file"](givenPath);
    }

    return resolvedPath;
}



export function regenerate_json(arg: { [key: string]: string }) {

    if (arg["-i"] == "null") errorMessages["No input directory"]();
    let inputObject: string = arg["-i"];
    let input = getDirectory(inputObject);

    let projectJsonPath = path.join(input, 'project.d.json');
    if (fs.existsSync(projectJsonPath)) {
        fs.unlink(projectJsonPath, (err) => { if (err) errorMessages["How did you get here"](); });
    }

    let projectJsonNew = "{"

    fs.readdirSync(input).forEach(file => {

        if (file.slice(-7) == ".sprite" || file.slice(-11) == ".background") {
            if (file.slice(-7) == ".sprite"){
                projectJsonNew += `"${file.slice(0, -7)}": {"Type":"Sprite","Costumes":[`;
            } else {
                projectJsonNew += `"${file.slice(0, -11)}": {"Type":"Background","Costumes":[`;

            }

            let totalpath = path.join(path.join(input, file), "images");
            let costumeJson = ""
            if (fs.existsSync(totalpath)) {
                //console.log("here")

                fs.readdirSync(totalpath).forEach(image => {
                    let imagepath = path.join(totalpath, image);
                    //console.log(imagepath)
                    if (image.slice(-4) == ".png")
                        console.log(`image ${imagepath} in sprite ${file}`)
                    costumeJson += `["${image.slice(0, -4)}","${imagepath.replace(/\\/g,"//")}"],`

                });


            } else {
                console.log(`${file} is a sprite with no images`)

            }
            costumeJson = costumeJson.slice(0, -1)
            costumeJson += "],"
            projectJsonNew += costumeJson + `"Sounds":[]},`

        }

    });
    
    projectJsonNew = projectJsonNew.slice(0, -1)+"}"

    fs.writeFileSync(projectJsonPath,projectJsonNew)
}

// Starts the JS2Scratch Environment.
export function start_env(arg: { [key: string]: string }) {
    if (arg["-i"] == "null") errorMessages["No input directory"]();
    let inputObject: string = arg["-i"];

    let input = getDirectory(inputObject);
    let isValid = validate.validateDirectorySchema(input);

    if (!isValid.isValid) errorMessages["File Structure"](isValid.errors);

    let sprites = [] as Sprite[]

    let projectInput = JSON.parse(readFile(path.join(input, 'project.d.json')));
    let projectValues = Object.values(projectInput);
    let projectKeys = Object.keys(projectInput);

    // "Hydrate" the tmp folder.
    const directory = path.join(__dirname, '../tmp');
    const files = fs.readdirSync(path.join(__dirname, '../tmp'));

    console.log(
        chalk.green(chalk.bold(
            "Building "
        )) + `${path.basename(inputObject)} - v0.0.1 - (${inputObject})`
    )


    for (let i = 0; i < projectKeys.length; i++) {
        let sprite = projectValues[i] as { Type: string, Costumes: any[], Sounds: any[] };
        let isStage = sprite.Type === "Background";
        let keyName = isStage ? "Stage" : projectKeys[i];
        let costumes: Costume[] = [];
        let sounds: Sound[] = [];

        if (isStage) keyName = "Stage";

        for (let v = 0; v < sprite.Costumes.length; v++) {
            let obj = sprite.Costumes[v];

            costumes.push(
                createCostume({
                    name: obj[0],
                    path: obj[1],
                })
            );
        }

        for (let v = 0; v < sprite.Sounds.length; v++) {
            let obj = sprite.Sounds[v];

            sounds.push(
                createSound({
                    name: obj[0],
                    path: obj[1],
                })
            );
        }

        let blocks = {};


        for (const file of fs.readdirSync(inputObject)) {
            let fullPath = path.join(inputObject, file);
            if (fs.statSync(fullPath).isFile()) {
                let parts = path.basename(file).split('.');
                if (parts[0] == keyName && parts[1] == sprite.Type && parts[2] == "js") {
                    Object.assign(blocks, build.transpileFromSource(fs.readFileSync(fullPath).toString(), fullPath));
                }
            } else {
                let folderContents = fs.readdirSync(fullPath);

                for (let i = 0; i < folderContents.length; i++) {
                    if (!fs.statSync(path.join(fullPath,folderContents[i])).isDirectory()){
                    let object = path.join(fullPath, folderContents[i]);
                    //console.log(object)
                    let base = path.basename(fullPath).toLowerCase().split(".");
                    if (base[1] == sprite.Type.toLowerCase() && base[0] == keyName.toLowerCase()) {
                        Object.assign(blocks, build.transpileFromSource(fs.readFileSync(object).toString(), object));
                    }
                }
                }
            }
        }

        sprites.push(createSprite({
            isStage: isStage,
            name: keyName,
            costumes: costumes,
            sounds: sounds,
            blocks: blocks
        }));
    }

    for (const file of files) {
        const filePath = path.join(directory, file);
        fs.unlinkSync(filePath);
    }

    createProject(arg["-o"] != "null" && arg["-o"] || path.join(process.cwd(), 'out',), 'Project', {
        targets: sprites
    }, arg);
}